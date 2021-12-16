// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as data from './data'
import { Context } from '..'
import Docker from 'dockerode'
import { arch } from 'os'
import { getDockerOptions } from './cli'
import { toUpperCaseFirst } from '../helpers'

const secure = (device: data.Device): data.Device => ({
  network: device.network,
  address: device.address,
  publicKey: '****',
  privateKey: '****'
})

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const device = ({ logger, wallet, xe, network, parent }: Context, name = 'device') => {
  const log = logger(name)

  let dockerInstance: Docker | undefined

  const docker = () => {
    if (dockerInstance === undefined) {
      const options = getDockerOptions(parent)
      dockerInstance = new Docker(options)
      log.debug('connected to Docker', { options })
    }
    return dockerInstance
  }

  const volume = async (canCreate = false) => {
    const d = docker()
    const vol = data.withVolume(d, await data.volume(d, canCreate))

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

    const write = async(data: data.Device) => {
      log.debug('writing to volume', { data: secure(data) })
      return vol.write(data)
    }

    return {
      read,
      remove,
      write
    }
  }

  const node = async () => {
    const address = await wallet().address()
    const deviceWallet = await (await volume()).read()

    log.debug('finding node', { address, deviceAddress: deviceWallet.address, network: deviceWallet.network })

    const stake = Object.values(await xe().stakes(address)).find(s => s.device === deviceWallet.address)
    if (stake === undefined) throw new Error('device is not assigned to a stake')

    const image = network.registry.imageName(stake.type, arch())
    const name = toUpperCaseFirst(stake.type)
    const containerName = `edge_${stake.type}_${Math.random().toString(16).substring(2, 8)}`

    log.debug('found node', { image, name, stake })

    const container = async () => {
      log.debug('finding container', { containerName })
      const remoteName = `/${containerName}`
      const info = (await docker().listContainers()).find(c => c.Names.includes(remoteName))
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
      containerName,
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
