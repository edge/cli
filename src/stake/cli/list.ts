// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import { Command } from 'commander'
import { Context } from '../../main'
import { checkVersionHandler } from '../../update/cli'
import config from '../../config'
import { errorHandler } from '../../cli'
import { formatXE } from '../../transaction/xe'
import { StakeStatus, StakeWithStatus, addStatus, byPrecedence } from '..'
import { formatTime, printTable, toUpperCaseFirst } from '../../helpers'

const statusMap: Record<StakeStatus, (stake: StakeWithStatus) => string> = {
  assigned: () => 'Assigned',
  released: () => 'Released',
  unassigned: () => 'Unassigned',
  unlocked: () => 'Unlocked',
  unlocking: stake => `Unlocking (unlocks at ${formatTime(stake.unlockRequested as number + stake.unlockPeriod)})`
}

/** List stakes associated with the host wallet. */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.stake.readStatus(ctx.cmd),
    ...cli.stake.readType(ctx.cmd),
    ...cli.verbose.read(ctx.parent)
  }

  const address = await ctx.wallet().address()
  const stakes = Object.values(await ctx.xeClient().stakes(address))

  const table = printTable<StakeWithStatus>(
    ['Type', 'ID', 'Hash', 'Created', 'Tx', 'Amount', 'Status'],
    stake => [
      toUpperCaseFirst(stake.type),
      opts.verbose ? stake.id : stake.id.slice(0, config.id.shortLength),
      opts.verbose ? stake.hash : stake.hash.slice(0, config.hash.shortLength),
      formatTime(stake.created),
      opts.verbose ? stake.transaction : stake.transaction.slice(0, config.hash.shortLength),
      formatXE(stake.amount),
      statusMap[stake.status](stake)
    ]
  )

  let matchStakes = stakes.map(addStatus)
  if (opts.stakeType !== undefined) matchStakes = matchStakes.filter(s => s.type === opts.stakeType)
  if (opts.stakeStatus !== undefined) matchStakes = matchStakes.filter(s => s.status === opts.stakeStatus)

  console.log(table(matchStakes.sort(byPrecedence)))
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('list').alias('ls').description('list all stakes').addHelpText('after', help)
  cli.stake.configureStatus(cmd)
  cli.stake.configureType(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = `
Displays all stakes associated with your wallet.
`
