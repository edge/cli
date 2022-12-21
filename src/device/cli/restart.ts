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
 * Restart a running device.
 *
 * If the device is not running, nothing happens.
 */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.docker.readPrefix(ctx.cmd)
  }

  const device = ctx.device(opts.prefix)
  const docker = device.docker()
  const node = await device.node()

  const info = await node.container()
  if (info === undefined) {
    repl.echo(`${node.name} is not running`)
    return
  }

  await docker.getContainer(info.Id).restart()
  repl.echo(`${node.name} restarted`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('restart').description('restart node').addHelpText('after', help)
  cli.docker.configurePrefix(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = repl.help(`
Restart the node, if it is running.
`)
