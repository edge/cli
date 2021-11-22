import * as xe from '@edge/xe-utils'
import config from '../config'
import { normalizedPlatform } from '../helpers'
import path from 'path'
import tar from 'tar-stream'
import Docker, { Container, VolumeInspectInfo } from 'dockerode'
import { readFile, writeFile } from 'fs'

export type Data = xe.wallet.Wallet & {
  network: string
}

export const createEmpty = (): Data => ({
  address: '',
  publicKey: '',
  privateKey: '',
  network: ''
})

const createTransferContainer = (docker: Docker, volume: VolumeInspectInfo, path: string): Promise<Container> =>
  docker.createContainer({
    // using Alpine Linux because of small footprint
    Image: 'docker.io/library/alpine:latest',
    // three-second sleep is generous, SIGKILL will cancel it
    Cmd: ['sleep', '3'],
    HostConfig: {
      Binds: [`${volume.Name}:${path}`]
    }
  })

export const keys: (keyof Data)[] = ['address', 'network', 'privateKey', 'publicKey']

export const read = async (docker: Docker, volume: VolumeInspectInfo): Promise<Data> => {
  const p = normalizedPlatform()
  if (p === 'macos' || p === 'windows') return readThroughContainer(docker, volume)
  return readDirect(volume)
}

const readDirect = async (volume: VolumeInspectInfo) => new Promise<Data>((resolve, reject) => {
  const data = createEmpty()
  let wait = keys.length
  keys.forEach(key => {
    const file = path.join(volume.Mountpoint, key)
    readFile(file, (err, txt) => {
      if (err !== null) return reject(err)
      data[key] = txt.toString()
      if (--wait === 0) return resolve(data as Data)
    })
  })
})

const readThroughContainer = async (docker: Docker, volume: VolumeInspectInfo): Promise<Data> => {
  const path = '/device'
  const container = await createTransferContainer(docker, volume, path)
  await container.start()
  try {
    const tmp = await container.getArchive({ path })
    return await new Promise<Data>((resolve, reject) => {
      const data = createEmpty()
      let wait = keys.length
      const archive = tar.extract()
      archive.on('entry', (h, s, next) => {
        const name = h.name.replace(/^\/?device\//, '') as keyof Data
        s.on('end', () => next())
        if (keys.includes(name)) {
          s.on('readable', () => {
            const txt = s.read()
            if (txt === null) return reject(`no data for ${name}`)
            data[name] = (txt as Buffer).toString()
            --wait
          })
        }
        s.resume()
      })
      archive.on('finish', () => {
        if (wait === 0) return resolve(data)
        return reject('failed to read all wallet data')
      })
      tmp.pipe(archive)
    })
  }
  finally {
    try {
      await container.kill()
      await container.remove()
    }
    catch (err) {
      console.log(`There was a problem cleaning up containers while reading device data: ${err}`)
      console.log([
        'Please run \'docker ps\' and/or \'docker container ls -a\' to check whether there are dangling images or ',
        'containers that may need to be cleaned up manually.'
      ].join(''))
    }
  }
}

/**
 * Get information about the data volume.
 *
 * By default, if the volume does not exist, it will be created on the fly.
 * Pass canCreate=false to disable this behaviour.
 */
export const volume = async (docker: Docker, canCreate = true): Promise<VolumeInspectInfo> => {
  let volume = docker.getVolume(config.docker.dataVolume)
  try {
    return await volume.inspect()
  }
  catch (err) {
    // if allowed to create volume, ignore no volume error
    const isNoVolume = err instanceof Error && err.message.match('no such volume')
    if (!isNoVolume || !canCreate) throw err
  }
  volume = await docker.createVolume({
    Name: config.docker.dataVolume
  })
  return await volume.inspect()
}

/**
 * Write device data to a volume (typically the data volume).
 */
export const write = async (docker: Docker, volume: VolumeInspectInfo, data: Data): Promise<void> => {
  const p = normalizedPlatform()
  if (p === 'macos' || p === 'windows') return writeThroughContainer(docker, volume, data)
  return writeDirect(volume, data)
}

/**
 * Write device data directly to a volume path on disk.
 *
 * This is only usable on systems that share their filesystem with Docker, e.g. Linux.
 */
const writeDirect = async (volume: VolumeInspectInfo, data: Data) => new Promise<void>((resolve, reject) => {
  let wait = keys.length
  keys.forEach(key => {
    const file = path.join(volume.Mountpoint, key)
    const value = data[key]
    writeFile(file, value, err => {
      if (err !== null) return reject(err)
      if (--wait === 0) return resolve()
    })
  })
  // TODO check uid/gid, allow setting manually
})

/**
 * Write device data to a volume (typically the data volume) using an intermediary container.
 *
 * This allows data to be written on virtualized systems (namely, Docker for Mac/Windows).
 *
 * API documentation: https://docs.docker.com/engine/api/v1.41/#operation/ContainerArchive
 */
const writeThroughContainer = async (docker: Docker, volume: VolumeInspectInfo, data: Data): Promise<void> => {
  const archive = tar.pack()
  keys.forEach(name => {
    archive.entry({ name }, data[name])
  })
  archive.finalize()

  const path = '/device'
  const container = await createTransferContainer(docker, volume, path)
  await container.start()
  try {
    await container.putArchive(archive, { path })
  }
  finally {
    try {
      await container.kill()
      await container.remove()
    }
    catch (err) {
      console.log(`There was a problem cleaning up containers while writing device data: ${err}`)
      console.log([
        'Please run \'docker ps\' and/or \'docker container ls -a\' to check whether there are dangling images or ',
        'containers that may need to be cleaned up manually.'
      ].join(''))
    }
  }
}
