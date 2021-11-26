// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as data from './data'
import * as xe from '@edge/xe-utils'
import Docker from 'dockerode'
import { Network } from '../main'
import { toUpperCaseFirst } from '../helpers'

/**
 * Get information about the device, node, and stake.
 *
 * The operative struct is the node, which concretizes the relationship between the device and network via a stake.
 * Accordingly, this function throws an error if the device is not assigned to a stake.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const withAddress = async (docker: Docker, network: Network, address: string) => {
  const dataVolume = await data.volume(docker)
  const device = await data.withVolume(docker, dataVolume).read()

  const stakes = await xe.stake.stakes(network.blockchain.baseURL, address)
  const stake = Object.values(stakes).find(s => s.device === device.address)
  if (stake === undefined) throw new Error('device is not assigned to a stake')

  const image = network.registry.imageName(stake.type)
  const name = toUpperCaseFirst(stake.type)

  return {
    device,
    image,
    container: async () => (await docker.listContainers()).find(c => c.Image === image),
    name,
    stake,
    dataVolume
  }
}
