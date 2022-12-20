import * as cli from '../../cli'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { CommandContext, Context } from '../..'

/**
 * Display the device status (`device status`).
 *
 * This only reports whether the device is running or not.
 * For more information about the device, use `device info` instead.
 */
export const action = (ctx: CommandContext) => async (): Promise<void> => {
  const opts = {
    ...cli.docker.readPrefix(ctx.cmd)
  }

  const userDevice = ctx.device(opts.prefix)
  const node = await userDevice.node()
  const info = await node.container()
  if (info === undefined) console.log(`${node.name} is not running`)
  else console.log(`${node.name} is running`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('status').description('display node status').addHelpText('after', help)
  cli.docker.configurePrefix(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = `
Display the status of the node (whether it is running or not).
`
