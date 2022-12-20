import * as cli from '../../cli'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { CommandContext, Context } from '../..'

/**
 * Stop a device (`device stop`).
 *
 * If the device is already stopped, nothing happens.
 */
export const action = ({ device, logger, ...ctx }: CommandContext) => async (): Promise<void> => {
  const log = logger()

  const { prefix } = cli.docker.readPrefix(ctx.cmd)

  const userDevice = device(prefix)
  const docker = userDevice.docker()
  const node = await userDevice.node()

  const info = await node.container()
  if (info === undefined) {
    console.log(`${node.name} is not running`)
    return
  }

  const container = docker.getContainer(info.Id)
  log.debug('stopping container', { id: info.Id })
  await container.stop()
  log.debug('removing container', { id: info.Id })
  await container.remove()
  console.log(`${node.name} stopped`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('stop').description('stop node').addHelpText('after', help)
  cli.docker.configurePrefix(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = `
Stop the node, if it is running.
`
