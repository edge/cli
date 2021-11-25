import * as data from './data'
import * as xe from '@edge/xe-utils'
import { Network } from '../main'
import { toUpperCaseFirst } from '../helpers'
import Docker, { ContainerInfo } from 'dockerode'

/**
 * Get information about the (first found) container using a specific image.
 */
export const containerByImage = async (docker: Docker, image: string): Promise<ContainerInfo|undefined> => {
  const containers = await new Promise<ContainerInfo[]>((resolve, reject) => docker.listContainers((err, result) => {
    if (err !== null) return reject(err)
    resolve(result || [])
  }))
  return containers.find(c => c.Image === image)
}

/**
 * Stop and remove a container.
 */
export const stop = async (docker: Docker, info: ContainerInfo): Promise<void> => {
  const container = docker.getContainer(info.Id)
  await new Promise<unknown>((resolve, reject) => container.stop((err, result) => {
    if (err !== null) return reject(err)
    return resolve(result)
  }))
  await new Promise<unknown>((resolve, reject) => container.remove((err, result) => {
    if (err !== null) return reject(err)
    return resolve(result)
  }))
}

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
    container: () => containerByImage(docker, image),
    name,
    stake,
    dataVolume
  }
}
