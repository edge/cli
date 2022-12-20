import * as cli from '../../cli'
import { Command } from 'commander'
import { errorHandler } from '../../cli'
import path from 'path'
import { Context, Network } from '../..'
import { chmodSync, copyFileSync, renameSync, unlinkSync } from 'fs'
import { currentVersion, download, latestVersion } from '..'

/** Update CLI. */
export const action = (ctx: Context, argv: string[]) => async (): Promise<void> => {
  const log = ctx.logger()
  const opts = {
    ...cli.debug.read(ctx.parent)
  }

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
    if (opts.debug) log.error('Unable to remove download', { err })
  }

  console.log(`Updated Edge CLI to v${lv}`)
}

export const command = (ctx: Context, argv: string[]): Command => {
  const cmd = new Command('update').description('update Edge CLI').addHelpText('after', help(ctx.network))
  cmd.action(errorHandler(ctx, action(ctx, argv)))
  return cmd
}

/** Help text for the `update` command. */
const help = (network: Network) => `
Update Edge CLI to the latest version.

To check for a new version without updating Edge CLI, use '${network.appName} update check' instead.
`
