import Docker, { ContainerInfo } from 'dockerode'

/**
 * Get information about the container for a specific image.
 */
export const info = async (docker: Docker, image: string): Promise<ContainerInfo|undefined> => {
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
