// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import { Network } from '../main'
import { SemVer } from 'semver'
import color from '../edge/color'
import path from 'path'
import pkg from '../../package.json'
import semver from 'semver'
import { tmpdir } from 'os'
import { VersionStatus, download, status } from '.'
import { chmodSync, copyFileSync, readFileSync, renameSync, stat, unlinkSync, writeFileSync } from 'fs'
import { errorHandler, getNoColorOption } from '../edge/cli'

const checkAction = (network: Network) => async (): Promise<void> => {
  const { current, latest, requireUpdate } = await status(network)
  if (requireUpdate) {
    console.log(`Current Edge CLI version: ${current}`)
    console.log()
    console.log(`A new version of Edge CLI is available (${latest}).`)
    console.log('Run \'edge update\' to update to the latest version.')
  }
  else console.log('Edge CLI is up to date.')
}

const checkHelp = [
  '\n',
  'Check for an update to Edge CLI.'
].join('')

const checkVersionCacheTimeout = 1000 * 60 * 60

/* eslint-disable @typescript-eslint/no-explicit-any */
export const checkVersionHandler =
  <T>(cli: Command, network: Network, f: (...args: any[]) => Promise<T>) =>
    async (...args: any[]): Promise<T|undefined> => {
      const fresult = await f(...args)

      const { noColor } = getNoColorOption(cli)

      // check for locally cached version data
      const cacheFile = tmpdir() + path.sep + '.edge-cli-version-check'
      let vinfo: VersionStatus|undefined = undefined
      try {
        vinfo = await new Promise<VersionStatus|undefined>((resolve, reject) => {
          stat(cacheFile, (err, info) => {
            if (err !== null) return reject(err)
            if (info.mtime.getTime() + checkVersionCacheTimeout < Date.now()) return resolve(undefined)
            const data = JSON.parse(readFileSync(cacheFile).toString())
            const current = new SemVer('0.0.1')
            const latest = new SemVer('0.0.1')
            Object.assign(current, data.current)
            Object.assign(latest, data.latest)
            return resolve({ current, latest, requireUpdate: data.requireUpdate })
          })
        })
      }
      catch (err) {
        // console.error(err)
      }
      if (vinfo === undefined) {
        // no local cache; check update server
        try {
          vinfo = await status(network)
        }
        catch (err) {
          // console.error(err)
          let msg = 'There was a problem reaching the update server. Please check your network connectivity.'
          if (!noColor) msg = color.warn(msg)
          console.log(msg)
        }
        try {
          writeFileSync(cacheFile, JSON.stringify(vinfo))
        }
        catch (err) {
          // console.error(err)
        }
      }
      if (vinfo !== undefined) {
        const current = semver.parse(pkg.version)
        if (current === null) throw new Error('Edge CLI version is invalid. Please update manually.')
        if (current.compare(vinfo.latest) < 0) {
          let msgs = [
            `A new version of Edge CLI is available (${vinfo.latest}).`,
            'Please run \'edge update\' to update to the latest version.'
          ]
          if (!noColor) msgs = msgs.map(l => color.info(l))
          msgs.forEach(l => console.log(l))
        }
      }

      return fresult
    }

const updateAction = (network: Network, argv: string[]) => async (): Promise<void> => {
  const { latest, requireUpdate } = await status(network)
  if (!requireUpdate) {
    console.log(`Edge CLI v${latest} is the latest version`)
    return
  }

  const selfPath = argv[0]

  if (/node$/.test(selfPath)) throw new Error('path to binary appears to be node path')

  console.log(`Downloading v${latest}`)
  const { file } = await download(network)
  const tmpFilename = `${path.dirname(file)}/tmp-${Date.now}`

  // After downloading the file, we move the current binary to a temporary
  // location, move the new file to the current binary location, and then
  // attempt to remove the previous binary. This may fail on windows.
  console.log(`Updating from v${pkg.version} to v${latest}`)
  chmodSync(file, 0o755)
  renameSync(selfPath, tmpFilename)
  copyFileSync(file, selfPath)

  // Try to remove file but ignore any errors.
  try {
    unlinkSync(tmpFilename)
  }
  catch (e) {
    // Nothing to see here.
  }

  console.log(`Updated Edge CLI to v${latest}`)
}

const updateHelp = [
  '\n',
  'Update Edge CLI to the latest version.\n\n',
  'To check for a new version without updating Edge CLI, use \'edge update check\' instead.'
].join('')

export const withProgram = (parent: Command, network: Network, argv: string[]): void => {
  const updateCLI = new Command('update')
    .description('update Edge CLI')
    .addHelpText('after', updateHelp)
    .action(errorHandler(parent, updateAction(network, argv)))

  const check = new Command('check')
    .description('check for updates')
    .addHelpText('after', checkHelp)
    .action(errorHandler(parent, checkAction(network)))

  updateCLI
    .addCommand(check)

  parent.addCommand(updateCLI)
}
