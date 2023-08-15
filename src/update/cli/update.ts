// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as repl from '../../repl'
import { Command } from 'commander'
import { arch } from 'os'
import { errorHandler } from '../../cli'
import { normalizedPlatform } from '../../helpers'
import path from 'path'
import { Context, Network } from '../../main'
import { chmodSync, copyFileSync, renameSync, unlinkSync } from 'fs'
import { currentVersion, download, ext, latestVersion } from '..'

/** Update CLI. */
export const action = (ctx: Context, argv: string[]) => async (): Promise<void> => {
  const log = ctx.log()
  const opts = {
    ...cli.debug.read(ctx.parent)
  }

  const cv = currentVersion()
  const lv = await latestVersion(ctx)

  if (lv.compare(cv) <= 0) {
    repl.echo(`Edge CLI v${cv} is the latest version`)
    return
  }

  const selfPath = argv[0]

  if (/node$/.test(selfPath)) throw new Error('path to binary appears to be node path')

  let tmpFilename = ''
  try {
    repl.echo(`Downloading v${lv}`)
    const { file } = await download(ctx)
    tmpFilename = `${path.dirname(file)}/tmp-${Date.now()}`

    // After downloading the file, we move the current binary to a temporary
    // location, move the new file to the current binary location, and then
    // attempt to remove the previous binary. This may fail on Windows.
    repl.echo(`Updating from v${cv} to v${lv}`)
    chmodSync(file, 0o755)
    renameSync(selfPath, tmpFilename)
    copyFileSync(file, selfPath)
  }
  catch (err) {
    log.error(`Failed to download Edge CLI v${cv}`, { err })
    const buildURL = ctx.network.files.latestBuildURL(normalizedPlatform(), arch(), ext())
    repl.nl()
    repl.echo('If you have difficulty updating Edge CLI via this method, you can download it manually from the following URL:')
    repl.nl()
    repl.echo(buildURL)
    return
  }

  // Try to remove file but ignore any errors.
  try {
    if (tmpFilename) unlinkSync(tmpFilename)
  }
  catch (err) {
    if (opts.debug) log.error('Unable to remove download', { err })
  }

  repl.echo(`Updated Edge CLI to v${lv}`)
}

export const command = (ctx: Context, argv: string[]): Command => {
  const cmd = new Command('update').description('update Edge CLI').addHelpText('after', help(ctx.network))
  cmd.action(errorHandler(ctx, action(ctx, argv)))
  return cmd
}

const help = (network: Network) => repl.help(`
Update Edge CLI to the latest version.

To check for a new version without updating Edge CLI, use '${network.appName} update check' instead.
`)
