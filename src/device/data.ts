// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as image from './image'
import * as xe from '@edge/xe-utils'
import config from '../config'
import { normalizedPlatform } from '../helpers'
import path from 'path'
import tar from 'tar-stream'
import Docker, { Container, VolumeInspectInfo } from 'dockerode'
import { readFile, writeFile } from 'fs'

export type Device = xe.wallet.Wallet & {
  network: string
}

const TRANSFER_CONTAINER_IMAGE = 'docker.io/library/alpine:latest'

export const createEmpty = (): Device => ({
  address: '',
  publicKey: '',
  privateKey: '',
  network: ''
})

const createTransferContainer = (docker: Docker, volume: VolumeInspectInfo, path: string): Promise<Container> =>
  docker.createContainer({
    // using Alpine Linux because of small footprint
    Image: TRANSFER_CONTAINER_IMAGE,
    // three-second sleep is generous, SIGKILL will cancel it
    Cmd: ['sleep', '3'],
    HostConfig: {
      Binds: [`${volume.Name}:${path}`]
    }
  })

export const keys: (keyof Device)[] = ['address', 'network', 'privateKey', 'publicKey']

/**
 * Read device data from a volume (typically the data volume).
 */
export const read = async (docker: Docker, volume: VolumeInspectInfo): Promise<Device> => {
  const p = normalizedPlatform()
  if (p === 'macos' || p === 'windows') return readThroughContainer(docker, volume)
  return config.docker.directReadWrite ? readDirect(volume) : readThroughContainer(docker, volume)
}

/**
 * Read device data directly from a volume path on disk.
 *
 * This is only usable on systems that share their filesystem with Docker, e.g. Linux.
 */
const readDirect = async (volume: VolumeInspectInfo) => new Promise<Device>((resolve, reject) => {
  const device = createEmpty()
  let wait = keys.length
  keys.forEach(key => {
    const file = path.join(volume.Mountpoint, key)
    readFile(file, (err, txt) => {
      if (err !== null) return reject(err)
      device[key] = txt.toString()
      if (--wait === 0) return resolve(device as Device)
    })
  })
})

/**
 * Read device data from a volume (typically the data volume) using an intermediary container.
 *
 * This allows data to be read from virtualized systems (namely, Docker for Mac/Windows).
 *
 * API documentation: https://docs.docker.com/engine/api/v1.41/#operation/ContainerArchive
 */
const readThroughContainer = async (docker: Docker, volume: VolumeInspectInfo): Promise<Device> => {
  const path = '/data'
  // eslint-disable-next-line max-len
  if (!await image.exists(docker, TRANSFER_CONTAINER_IMAGE)) await image.pullVisible(docker, TRANSFER_CONTAINER_IMAGE, undefined)
  const container = await createTransferContainer(docker, volume, path)
  await container.start()

  let tmpArchive: NodeJS.ReadableStream
  try {
    tmpArchive = await container.getArchive({ path })

    return await new Promise<Device>((resolve, reject) => {
      const device = createEmpty()
      let wait = keys.length

      const archive = tar.extract()
      archive.on('entry', (h, s, next) => {
        const name = h.name.replace(/^\/?data\//, '') as keyof Device
        s.on('end', () => next())
        if (keys.includes(name)) {
          s.on('readable', () => {
            const txt = s.read()
            if (txt === null) return reject(new Error(`no data for ${name}`))
            device[name] = (txt as Buffer).toString()
            --wait
          })
        }
        s.resume()
      })

      archive.on('finish', () => {
        if (wait === 0) return resolve(device)
        if (wait === keys.length) return reject(new Error('device is not initialized'))
        return reject(new Error('incomplete data'))
      })

      tmpArchive.pipe(archive)
    })
  }
  finally {
    await container.kill()
    await container.remove()
  }
}

/**
 * Remove a volume from Docker.
 */
export const remove = async (docker: Docker, volume: VolumeInspectInfo): Promise<void> => {
  await docker.getVolume(volume.Name).remove()
}

/**
 * Get information about the data volume.
 *
 * By default, if the volume does not exist, an error will be thrown.
 * Pass `true` as a third argument to silence this error and create the volume on the fly instead.
 */
export const volume = async (docker: Docker, suffix?: string, canCreate?: boolean): Promise<VolumeInspectInfo> => {
  let name = config.docker.dataVolume
  if (suffix) name = `${name}-${suffix}`
  let volume = docker.getVolume(name)
  try {
    return await volume.inspect()
  }
  catch (err) {
    // if allowed to create volume, ignore no volume error
    const isNoVolume = err instanceof Error && err.message.match('no such volume')
    if (!isNoVolume) throw err
    if (!canCreate) throw new Error('device has not been initialized')
  }
  volume = await docker.createVolume({
    Name: name
  })
  return await volume.inspect()
}

/**
 * Write device data to a volume (typically the data volume).
 */
export const write = async (docker: Docker, volume: VolumeInspectInfo, device: Device): Promise<void> => {
  const p = normalizedPlatform()
  if (p === 'macos' || p === 'windows') return writeThroughContainer(docker, volume, device)
  return config.docker.directReadWrite ? writeDirect(volume, device) : writeThroughContainer(docker, volume, device)
}

/**
 * Write device data directly to a volume path on disk.
 *
 * This is only usable on systems that share their filesystem with Docker, e.g. Linux.
 */
const writeDirect = async (volume: VolumeInspectInfo, device: Device) => new Promise<void>((resolve, reject) => {
  let wait = keys.length
  keys.forEach(key => {
    const file = path.join(volume.Mountpoint, key)
    const value = device[key]
    writeFile(file, value, err => {
      if (err !== null) return reject([err])
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
 * API documentation: https://docs.docker.com/engine/api/v1.41/#operation/PutContainerArchive
 */
const writeThroughContainer = async (docker: Docker, volume: VolumeInspectInfo, device: Device): Promise<void> => {
  const path = '/data'
  // eslint-disable-next-line max-len
  if (!await image.exists(docker, TRANSFER_CONTAINER_IMAGE)) await image.pullVisible(docker, TRANSFER_CONTAINER_IMAGE, undefined)
  const container = await createTransferContainer(docker, volume, path)

  await container.start()

  try {
    const archive = tar.pack()
    keys.forEach(name => {
      archive.entry({ name }, device[name])
    })
    archive.finalize()
    await container.putArchive(archive, { path })
  }
  finally {
    await container.kill()
    await container.remove()
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const withVolume = (docker: Docker, volume: VolumeInspectInfo) => ({
  read: () => read(docker, volume),
  remove: () => remove(docker, volume),
  write: (device: Device) => write(docker, volume, device)
})
