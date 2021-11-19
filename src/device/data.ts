import * as xe from '@edge/xe-utils'
import config from '../config'
import { normalizedPlatform } from '../helpers'
import path from 'path'
import tar from 'tar-stream'
import { writeFile } from 'fs'
import Docker, { VolumeInspectInfo } from 'dockerode'

export type Data = xe.wallet.Wallet & {
  network: string
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
  let wait = Object.keys(data).length;
  (Object.keys(data) as (keyof Data)[]).forEach(key => {
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
  const archive = tar.pack();
  (Object.keys(data) as (keyof Data)[]).forEach(name => {
    archive.entry({ name }, data[name])
  })
  archive.finalize()

  const containerPath = '/device'
  const container = await docker.createContainer({
    // using Alpine Linux because of small footprint
    Image: 'docker.io/library/alpine:latest',
    // three-second sleep is generous, SIGKILL will cancel it
    Cmd: ['sleep', '3'],
    HostConfig: {
      Binds: [`${volume.Name}:${containerPath}`]
    }
  })
  await container.start()
  try {
    await container.putArchive(archive, { path: containerPath })
  }
  catch (err) {
    console.error(err)
  }
  finally {
    try {
      await container.kill()
      await container.remove()
    }
    catch (err) {
      console.log(`There was a problem cleaning up the device initialization container: ${err}`)
      console.log([
        'Please run \'docker ps\' and/or \'docker container ls -a\' to check whether there are dangling images or ',
        'containers that may need to be cleaned up manually.'
      ].join(''))
    }
  }
}
