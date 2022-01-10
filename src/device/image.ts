import Docker, { AuthConfig } from 'dockerode'

export const exists = async (docker: Docker, imageName: string): Promise<boolean> => {
  const img = docker.getImage(imageName)
  try {
    await img.inspect()
  }
  catch (err) {
    // type of error ignored; we assume the image is unknown
    return false
  }
  return true
}

export const pull = async (
  docker: Docker,
  imageName: string,
  authconfig?: AuthConfig,
  onData = () => {/*silent*/}
): Promise<void> => new Promise((resolve, reject) => {
  docker.pull(imageName, { authconfig }, (err, stream) => {
    if (err !== null) return reject(err)
    stream.on('data', onData)
    stream.on('end', resolve)
  })
})
