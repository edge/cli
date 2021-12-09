// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Context } from '..'
import { createHash } from 'crypto'
import fs from 'fs/promises'
import { getDebugOption } from '../edge/cli'
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

const versionCacheTimeout = 1000 * 60 * 60

const calcDigest = async (file: string): Promise<string> => {
  const data = await fs.readFile(file)
  return createHash('sha256').update(data).digest('hex')
}

const downloadURL = async (url: string, file: string) => {
  const fh = await fs.open(file, 'w')
  const request = superagent.get(url)
  await fs.writeFile(fh, await request)
  await fh.close()
}

export const cachedLatestVersion = async ({ network, ...ctx }: Context): Promise<SemVer> => {
  const { debug } = getDebugOption(ctx.parent)
  const log = ctx.logger('update.version.cache')
  const file = tmpdir() + path.sep + '.edge-cli-version'
  let lv: SemVer|undefined = undefined
  try {
    log.debug('Reading cache file', { file })
    const stats = await fs.stat(file)
    if (stats.mtime.getTime() + versionCacheTimeout > Date.now()) {
      const data = (await fs.readFile(file)).toString()
      log.debug('Read cache data', { data })
      const parsed = parse(data)
      if (parsed !== null) lv = parsed
    }
    else log.debug('Cache outdated')
  }
  catch (err) {
    if (debug) log.error('Cache read error', { err })
  }
  if (lv === undefined) {
    lv = await latestVersion({ network, ...ctx })
    try {
      log.debug('Writing cache file', { data: lv.format(), file })
      await fs.writeFile(file, lv.format())
      log.debug('Wrote file', { file })
    }
    catch (err) {
      if (debug) log.error('Cache write error', { err })
    }
  }
  return lv
}

export const currentVersion = (): SemVer => {
  const cv = parse(pkg.version)
  if (cv === null) throw new Error(`package provided invalid version "${pkg.version}"`)
  return cv
}

export const download = async ({ network, ...ctx }: Context): Promise<DownloadInfo> => {
  const log = ctx.logger('update.download')
  try {
    const csURL = network.files.latestChecksumURL(normalizedPlatform(), arch())
    log.debug('Getting latest checksum', { url: csURL })
    const csResponse = await superagent.get(csURL)
    const checksum = csResponse.text.trim()
    log.debug('Response', { checksum })

    const file = await fs.mkdtemp(path.join(tmpdir(), 'edge-update-')) + path.sep + 'edge'
    const buildURL = network.files.latestBuildURL(normalizedPlatform(), arch(), ext())
    log.debug('Downloading latest build', { url: buildURL, file })
    await downloadURL(buildURL, file)
    log.debug('Downloaded', { file })

    log.debug('Verifying checksum')
    const filesum = await calcDigest(file)
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
    log.debug('Getting latest version', { url })
    const response = await superagent.get(url)
    log.debug('Response', { response })
    const lv = parse(response.text.trim())
    if (lv === null) throw new Error(`server provided invalid version "${response.text}"`)
    return lv
  }
  catch (err) {
    throw new Error(`unable to retrieve latest version: ${err}`)
  }
}
