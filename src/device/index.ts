// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as data from './data'
import { Context } from '..'
import Docker from 'dockerode'
import { arch } from 'os'
import { getDockerOptions } from './cli'
import { toUpperCaseFirst } from '../helpers'

const currentTag = (): string => 'latest'

const secure = (device: data.Device): data.Device => ({
  network: device.network,
  address: device.address,
  publicKey: '****',
  privateKey: '****'
})

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const device = ({ logger, wallet, xe, network, parent }: Context, name = 'device') => {
  const log = logger(name)

  let dockerInstance: Docker

  const docker = () => {
    if (dockerInstance === undefined) {
      const options = getDockerOptions(parent)
      log.debug('connecting to Docker', { options })
      dockerInstance = new Docker(options)
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

    const image = network.registry.imageName(stake.type, arch()) + ':' + currentTag()
    const name = toUpperCaseFirst(stake.type)

    log.debug('found node', { image, name, stake })

    const container = async () => {
      log.debug('finding container', { name, image })
      const info = (await docker().listContainers()).find(c => c.Image === image)
      if (info !== undefined) log.debug('found container', { id: info.Id })
      return info
    }

    return {
      container,
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
