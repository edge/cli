// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../cli'
import { Context } from '..'
import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import fs from 'fs/promises'
import { normalizedPlatform } from '../helpers'
import path from 'path'
import pkg from '../../package.json'
import superagent from 'superagent'
import { SemVer, parse } from 'semver'
import { arch, tmpdir } from 'os'

export type DownloadInfo = {
  checksum: string
  file: string
}

/**
 * One-hour timeout for the version cache.
 * This is used to mitigate load on the update server.
 */
const versionCacheTimeout = 1000 * 60 * 60

/** Calculate the SHA-256 digest of a [CLI update] file. */
const calcDigest = async (file: string): Promise<string> => {
  const data = await fs.readFile(file)
  return createHash('sha256').update(data).digest('hex')
}

/** Download a [CLI update] file. */
const downloadURL = async (url: string, file: string) => new Promise<void>((resolve, reject) => {
  const stream = createWriteStream(file)
  const request = superagent.get(url)
  request.on('end', () => {
    stream.close()
    resolve()
  })
  request.on('error', err => {
    stream.close()
    reject(err)
  })
  request.pipe(stream)
})

/**
 * Poll the latest version of CLI, reading from/updating the local cache as applicable.
 * The cache timeout is specified by `versionCacheTimeout`.
 */
export const cachedLatestVersion = async ({ network, ...ctx }: Context): Promise<SemVer> => {
  const { debug } = cli.debug.read(ctx.parent)
  const log = ctx.logger('update.version.cache')
  const file = tmpdir() + path.sep + '.edge-cli-version'
  let lv: SemVer|undefined = undefined
  try {
    log.debug('reading cache file', { file })
    const stats = await fs.stat(file)
    if (stats.mtime.getTime() + versionCacheTimeout > Date.now()) {
      const data = (await fs.readFile(file)).toString()
      log.debug('read cache data', { data })
      const parsed = parse(data)
      if (parsed !== null) lv = parsed
    }
    else log.debug('cache outdated')
  }
  catch (err) {
    if (debug) log.error('Cache read error', { err })
  }
  if (lv === undefined) {
    lv = await latestVersion({ network, ...ctx })
    try {
      log.debug('writing cache file', { data: lv.format(), file })
      await fs.writeFile(file, lv.format())
      log.debug('wrote file', { file })
    }
    catch (err) {
      if (debug) log.error('Cache write error', { err })
    }
  }
  return lv
}

/**
 * Get the current version of CLI from `package.json`.
 */
export const currentVersion = (): SemVer => {
  const cv = parse(pkg.version)
  if (cv === null) throw new Error(`package provided invalid version "${pkg.version}"`)
  return cv
}

/** Download and validate the latest version of CLI. */
export const download = async ({ network, ...ctx }: Context): Promise<DownloadInfo> => {
  const log = ctx.logger('update.download')
  try {
    const csURL = network.files.latestChecksumURL(normalizedPlatform(), arch())
    log.debug('getting latest checksum', { url: csURL })
    const csResponse = await superagent.get(csURL)
    const checksum = csResponse.text.trim()
    log.debug('response', { checksum })

    const file = await fs.mkdtemp(path.join(tmpdir(), 'edge-update-')) + path.sep + 'edge'
    const buildURL = network.files.latestBuildURL(normalizedPlatform(), arch(), ext())
    log.debug('downloading latest build', { url: buildURL, file })
    await downloadURL(buildURL, file)
    log.debug('downloaded', { file })

    const filesum = await calcDigest(file)
    log.debug('verifying checksum', { checksum, filesum })
    if (checksum === filesum) return { checksum, file }
    throw new Error(`checksum mismatch (local = ${filesum}, remote = ${checksum})`)
  }
  catch (err) {
    throw new Error(`failed to download latest binary: ${err}`)
  }
}

const ext = (): string => normalizedPlatform() === 'windows' ? '.exe' : ''

export const latestVersion = async ({ network, ...ctx }: Context): Promise<SemVer> => {
  const log = ctx.logger('update.version.get')
  const url = network.files.latestVersionURL(normalizedPlatform(), arch())
  try {
    log.debug('getting latest version', { url })
    const response = await superagent.get(url)
    log.debug('response', { status: response.status, text: response.text })
    const lv = parse(response.text.trim())
    if (lv === null) throw new Error(`server provided invalid version "${response.text}"`)
    return lv
  }
  catch (err) {
    throw new Error(`unable to retrieve latest version: ${err}`)
  }
}
