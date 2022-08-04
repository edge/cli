// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import color from '../edge/color'
import path from 'path'
import { Context, Network } from '..'
import { cachedLatestVersion, currentVersion, download, latestVersion } from '.'
import { chmodSync, copyFileSync, renameSync, unlinkSync } from 'fs'
import { errorHandler, getDebugOption, getNoColorOption } from '../edge/cli'

/**
 * Check Edge Network Files for a newer version of CLI, relative to the current CLI (`update check`).
 */
const checkAction = (ctx: Context) => async (): Promise<void> => {
  const cv = currentVersion()
  const lv = await latestVersion(ctx)
  if (lv.compare(cv) > 0) {
    console.log(`Current Edge CLI version: v${cv}`)
    console.log()
    console.log(`A new version of Edge CLI is available (v${lv}).`)
    console.log(`Run '${ctx.network.appName} update' to update to the latest version.`)
  }
  else console.log('Edge CLI is up to date.')
}

/** Help text for the `update check` command. */
const checkHelp = [
  '\n',
  'Check for an update to Edge CLI.'
].join('')

/**
 * Handler to check for any CLI updates.
 * This wraps any command to provide a background poll capability, displaying a CTA if an update is available.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const checkVersionHandler =
  <T>(ctx: Context, f: (...args: any[]) => Promise<T>) =>
    async (...args: any[]): Promise<T|undefined> => {
      const result = await f(...args)

      const { debug, noColor } = {
        ...getDebugOption(ctx.parent),
        ...getNoColorOption(ctx.parent)
      }

      const log = ctx.logger()
      try {
        const cv = currentVersion()
        const lv = await cachedLatestVersion(ctx)

        if (lv.compare(cv) > 0) {
          console.log([
            `A new version of Edge CLI is available (v${lv}).`,
            `Please run '${ctx.network.appName} update' to update to the latest version.`
          ].map(l => noColor ? l : color.notice(l)).join('\n'))
        }
      }
      catch (err) {
        if (debug) log.error('Error checking latest version', { err })
        else log.warn('There was a problem reaching the update server. Please check your network connectivity.')
      }

      return result
    }

/**
 * Update CLI (`update`).
 */
const updateAction = (ctx: Context, argv: string[]) => async (): Promise<void> => {
  const log = ctx.logger()

  const { debug } = getDebugOption(ctx.parent)

  const cv = currentVersion()
  const lv = await latestVersion(ctx)

  if (lv.compare(cv) <= 0) {
    console.log(`Edge CLI v${cv} is the latest version`)
    return
  }

  const selfPath = argv[0]

  if (/node$/.test(selfPath)) throw new Error('path to binary appears to be node path')

  console.log(`Downloading v${lv}`)
  const { file } = await download(ctx)
  const tmpFilename = `${path.dirname(file)}/tmp-${Date.now}`

  // After downloading the file, we move the current binary to a temporary
  // location, move the new file to the current binary location, and then
  // attempt to remove the previous binary. This may fail on Windows.
  console.log(`Updating from v${cv} to v${lv}`)
  chmodSync(file, 0o755)
  renameSync(selfPath, tmpFilename)
  copyFileSync(file, selfPath)

  // Try to remove file but ignore any errors.
  try {
    unlinkSync(tmpFilename)
  }
  catch (err) {
    if (debug) log.error('Unable to remove download', { err })
  }

  console.log(`Updated Edge CLI to v${lv}`)
}

/** Help text for the `update` command. */
const updateHelp = (network: Network) => [
  '\n',
  'Update Edge CLI to the latest version.\n\n',
  `To check for a new version without updating Edge CLI, use '${network.appName} update check' instead.`
].join('')

/** Configure `update` commands with root context. */
export const withContext = (ctx: Context, argv: string[]): Command => {
  const updateCLI = new Command('update')
    .description('update Edge CLI')
    .addHelpText('after', updateHelp(ctx.network))
    .action(errorHandler(ctx, updateAction(ctx, argv)))

  const check = new Command('check')
    .description('check for updates')
    .addHelpText('after', checkHelp)
    .action(errorHandler(ctx, checkAction(ctx)))

  updateCLI
    .addCommand(check)

  return updateCLI
}
