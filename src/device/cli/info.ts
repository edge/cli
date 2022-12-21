// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as repl from '../../repl'
import { Command } from 'commander'
import { Context } from '../../main'
import { checkVersionHandler } from '../../update/cli'
import config from '../../config'
import { errorHandler } from '../../cli'
import { printData, toUpperCaseFirst } from '../../helpers'

/**
 * Display device information.
 */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.debug.read(ctx.parent),
    ...cli.docker.readPrefix(ctx.cmd),
    ...cli.verbose.read(ctx.parent)
  }

  const printID = (id: string) => opts.verbose ? id: id.slice(0, config.id.shortLength)

  const log = ctx.log()
  const device = ctx.device(opts.prefix)
  const deviceWallet = await (await device.volume()).read()

  const toPrint: Record<string, string> = {
    Network: toUpperCaseFirst(deviceWallet.network),
    Device: deviceWallet.address
  }

  try {
    const address = await ctx.wallet().address()
    const stake = Object.values(await ctx.xeClient().stakes(address)).find(s => s.device === deviceWallet.address)
    if (stake !== undefined) {
      toPrint.Type = toUpperCaseFirst(stake.type)
      toPrint.Stake = printID(stake.id)
    }
    else toPrint.Stake = 'Unassigned'
  }
  catch (err) {
    if (opts.debug) log.error(`${err}`, { err })
    toPrint.Stake = 'Unassigned (no wallet)'
  }

  repl.raw(printData(toPrint))
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('info').description('display device/stake information').addHelpText('after', help)
  cli.docker.configurePrefix(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = repl.help(`
This command displays information about your device and the stake it is assigned to.
`)
