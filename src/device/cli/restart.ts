import * as cli from '../../cli'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { CommandContext, Context } from '../..'

/**
 * Restart a running device (`device restart`).
 *
 * If the device is not running, nothing happens.
 */
export const action = ({ device, ...ctx }: CommandContext) => async (): Promise<void> => {
  const { prefix } = cli.docker.readPrefix(ctx.cmd)
  const userDevice = device(prefix)
  const docker = userDevice.docker()
  const node = await userDevice.node()

  const info = await node.container()
  if (info === undefined) {
    console.log(`${node.name} is not running`)
    return
  }

  await docker.getContainer(info.Id).restart()
  console.log(`${node.name} restarted`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('restart').description('restart node').addHelpText('after', help)
  cli.docker.configurePrefix(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = `
Restart the node, if it is running.
`
