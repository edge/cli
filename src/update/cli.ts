import { Command } from 'commander'
import { Network } from '../main'
import { SemVer } from 'semver'
import { errorHandler } from '../edge/cli'
import path from 'path'
import { tmpdir } from 'os'
import { VersionStatus, download, status } from '.'
import { chmodSync, copyFileSync, readFileSync, stat, writeFileSync } from 'fs'

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
  <T>(network: Network, f: (...args: any[]) => Promise<T>) =>
    async (...args: any[]): Promise<T|undefined> => {
      const fresult = await f(...args)

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
          console.log('There was a problem reaching the update server. Please check your network connectivity.')
        }
        try {
          writeFileSync(cacheFile, JSON.stringify(vinfo))
        }
        catch (err) {
          // console.error(err)
        }
      }
      if (vinfo !== undefined) {
        if (vinfo.requireUpdate) {
          console.log(`A new version of Edge CLI is available (${vinfo.latest}).`)
          console.log('Please run \'edge update\' to update to the latest version.')
        }
      }

      return fresult
    }
/* eslint-enable @typescript-eslint/no-explicit-any */

const updateAction = (network: Network, argv: string[]) => async (): Promise<void> => {
  const { latest, requireUpdate } = await status(network)
  if (!requireUpdate) {
    console.log('Edge CLI is up to date.')
    return
  }

  const selfPath = argv[0]
  if (/node$/.test(selfPath)) throw new Error('path to binary appears to be node path')
  const { file } = await download(network)
  chmodSync(file, 0o755)
  copyFileSync(file, selfPath)

  console.log(`Updated Edge CLI to ${latest}`)
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
