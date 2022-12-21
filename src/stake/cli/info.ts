// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as repl from '../../repl'
import { Command } from 'commander'
import { Context } from '../../main'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { formatXE } from '../../transaction/xe'
import { xeVars } from '.'

/** Display on-chain staking info. */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.debug.read(ctx.parent)
  }

  const vars = await xeVars(ctx.xeClient(), opts.debug)

  const amounts = [
    vars.host_stake_amount,
    vars.gateway_stake_amount,
    vars.stargate_stake_amount
  ].map(mxe => formatXE(mxe))
  const longest = amounts.reduce((l, s) => Math.max(l, s.length), 0)
  const [hostAmt, gatewayAmt, stargateAmt] = amounts.map(a => a.padStart(longest, ' '))

  repl.echo(`
  Current staking amounts:
    Stargate: ${stargateAmt}
    Gateway:  ${gatewayAmt}
    Host:     ${hostAmt}
  `)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('info').description('get on-chain staking information').addHelpText('after', help)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = repl.help(`
Displays current staking amounts.
`)
