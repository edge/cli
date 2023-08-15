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
 * Display the device status.
 *
 * This only reports whether the device is running or not.
 * For more information about the device, use `device info` instead.
 */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.docker.readPrefix(ctx.cmd),
    ...cli.stake.read(ctx.cmd)
  }

  const device = ctx.device(opts.prefix)
  const node = await device.node(opts.stake)
  const info = await node.container()
  if (info === undefined) repl.echo(`${node.name} is not running`)
  else repl.echo(`${node.name} is running`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('status').description('display node status').addHelpText('after', help)
  cli.docker.configurePrefix(cmd)
  cli.stake.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = repl.help(`
Display the status of the node (whether it is running or not).
`)
