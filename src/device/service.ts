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
