import readline from 'readline'
import Docker, { AuthConfig } from 'dockerode'

/**
 * PullStatus
 */
export type PullStatus = {
  status: string
  id?: string
  progress?: string
  progressDetail?: {
    current: number
    total: number
  }
}

/**
 * Check whether an image exists in Docker.
 *
 * For convenience, this function has no failure case. In the event of an error (e.g. loss of connection) it simply
 * returns false. Calling code should continue to attempt to interact with Docker, and safely handle any error arising
 * from imperative actions.
 */
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

/**
 * Pull a remote image to Docker.
 *
 * An `onData` callback can be provided to receive updates on pull status during download.
 */
export const pull = async (
  docker: Docker,
  imageName: string,
  authconfig?: AuthConfig,
  onData?: (status: PullStatus) => void
): Promise<void> => new Promise((resolve, reject) => {
  docker.pull(imageName, { authconfig }, (err, stream) => {
    if (err !== null) return reject(err)
    if (onData !== undefined) {
      stream.on('data', (b: Buffer) => {
        // it is possible for multiple json strings to be bundled in a single response, so we just take the latest
        const d = b.toString().split('\n').filter(l => l).pop() as string
        try {
          const status = JSON.parse(d) as PullStatus
          onData(status)
        }
        catch (err) {
          console.error(err, d)
        }
      })
    }
    stream.on('end', resolve)
  })
})

/**
 * Pull a remote image to Docker with standard display of pull status.
 *
 * If `keepText` is false (the default), this function will flash pull status text to stdout to indicate progress,
 * self-cleaning after each update.
 *
 * If `keepText` is true, each pull status update is written to a new line without clearing the previous update.
 * This may be useful for debugging.
 */
export const pullVisible = async (
  docker: Docker,
  imageName: string,
  authconfig?: AuthConfig,
  keepText = false
): Promise<void> => {
  const ws = process.stdout

  let canWrite = true
  const buf: PullStatus[] = []

  const update = (status: PullStatus) => {
    if (keepText) {
      if (status.progress) console.log(status.status, status.progress)
      else console.log(status.status)
    }
    else {
      readline.clearLine(ws, -1, () => {
        readline.cursorTo(ws, 0, undefined, () => {
          if (status.progress) canWrite = ws.write(`${status.status} ${status.progress}`)
          else canWrite = ws.write(status.status)
        })
      })
    }
  }

  const onDrain = () => {
    const status = buf.shift()
    if (status === undefined) return
    canWrite = true
    update(status)
  }

  if (!keepText) ws.on('drain', onDrain)

  await pull(docker, imageName, authconfig, status => {
    if (canWrite) update(status)
    else buf.push(status)
  })

  if (!keepText) {
    ws.off('drain', onDrain)
    readline.clearLine(ws, -1, () => {
      readline.cursorTo(ws, 0, undefined)
    })
  }
}
