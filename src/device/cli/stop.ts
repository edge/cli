// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as repl from '../../repl'
import { Command } from 'commander'
import { Context } from '../../main'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'

/**
 * Stop a device.
 *
 * If the device is already stopped, nothing happens.
 */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.docker.readPrefix(ctx.cmd),
    ...cli.stake.read(ctx.cmd)
  }

  const log = ctx.log()
  const device = ctx.device(opts.prefix)
  const docker = device.docker()
  const node = await device.node(opts.stake)

  const info = await node.container()
  if (info === undefined) {
    repl.echo(`${node.name} is not running`)
    return
  }

  const container = docker.getContainer(info.Id)
  log.debug('stopping container', { id: info.Id })
  await container.stop()
  log.debug('removing container', { id: info.Id })
  await container.remove()
  repl.echo(`${node.name} stopped`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('stop').description('stop node').addHelpText('after', help)
  cli.docker.configurePrefix(cmd)
  cli.stake.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = repl.help(`
Stop the node, if it is running.
`)
