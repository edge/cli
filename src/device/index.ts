// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../cli'
import * as data from './data'
import { Context } from '..'
import Docker from 'dockerode'
import { arch } from 'os'
import { toUpperCaseFirst } from '../helpers'

/** Secure device data by obscuring its keypair. */
const secure = (device: data.Device): data.Device => ({
  network: device.network,
  address: device.address,
  publicKey: '****',
  privateKey: '****'
})

/**
 * Create a device object.
 *
 * This provides simplified getters for the Docker service, device node, and data volume.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const device = ({ logger, wallet, xe, network, parent }: Context, prefix: string | undefined, name = 'device') => {
  const log = logger(name)

  let dockerInstance: Docker | undefined

  // get docker instance. automatically initializes if not already connected
  const docker = () => {
    if (dockerInstance === undefined) {
      const options = cli.docker.readConnection(parent)
      dockerInstance = new Docker(options)
      log.debug('connected to Docker', { options })
    }
    return dockerInstance
  }

  // get simple volume representation object with read, write, and delete methods
  const volume = async (canCreate = false) => {
    const d = docker()

    const vol = data.withVolume(d, await data.volume(d, prefix, canCreate))

    const read = async () => {
      log.debug('reading volume')
      const data = await vol.read()
      log.debug('read volume', { data: secure(data) })
      return data
    }

    const remove = async () => {
      log.debug('removing volume')
      return vol.remove()
    }

    const write = async (data: data.Device) => {
      log.debug('writing to volume', { data: secure(data) })
      return vol.write(data)
    }

    return {
      read,
      remove,
      write
    }
  }

  // get device node information including the assigned stake and, if running, the Docker container
  const node = async () => {
    const address = await wallet().address()
    const deviceWallet = await (await volume()).read()

    log.debug('finding node', { address, deviceAddress: deviceWallet.address, network: deviceWallet.network })

    const stake = Object.values(await xe().stakes(address)).find(s => s.device === deviceWallet.address)
    if (stake === undefined) throw new Error('device is not assigned to a stake')

    const image = network.registry.imageName(stake.type, arch())
    const name = toUpperCaseFirst(stake.type)
    const containerNamePrefix = ['edge', stake.type, prefix].filter(Boolean).join('-') + '-'

    log.debug('found node', { image, name, stake })

    const container = async () => {
      log.debug('finding container with prefix', { containerNamePrefix })
      const remoteName = `/${containerNamePrefix}`
      const containers = await docker().listContainers()
      const infos = containers.filter(c => c.Names.find(n => n.startsWith(remoteName)))
      let info: Docker.ContainerInfo | undefined
      if (infos.length === 0) return undefined
      else if (infos.length === 1) info = infos[0]
      else {
        // multiple matches; if prefix is set, this is unexpected and a problem
        if (prefix) throw new Error('ambiguous prefix')
        // otherwise, resolve to the un-prefixed node (if any)
        info = containers.find(c => c.Names.filter(n => n.split('-').length === 3))
      }
      if (info !== undefined) {
        log.debug('found container', {
          id: info.Id,
          image: info.Image,
          imageID: info.ImageID
        })
      }
      return info
    }

    return {
      container,
      containerName: container.name,
      image,
      name,
      stake
    }
  }

  return {
    docker,
    node,
    volume
  }
}

export default device
