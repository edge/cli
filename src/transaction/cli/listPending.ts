// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as xeUtils from '@edge/xe-utils'
import { Command } from 'commander'
import { Context } from '../../main'
import { checkVersionHandler } from '../../update/cli'
import config from '../../config'
import { errorHandler } from '../../cli'
import { formatXE } from '../xe'
import { formatTime, printTable } from '../../helpers'

/** List pending transactions for the host wallet. */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.verbose.read(ctx.parent)
  }

  const address = await ctx.wallet().address()

  const txs = await ctx.xeClient().pendingTransactions(address)
  if (txs.length === 0) {
    console.log('No pending transactions')
    return
  }

  const table = printTable<xeUtils.tx.Tx>(
    ['Time', 'Tx', 'From', 'To', 'Amount', 'Memo', 'Nonce', 'Signature'],
    tx => [
      formatTime(tx.timestamp),
      opts.verbose ? tx.hash : tx.hash.slice(0, config.hash.shortLength),
      opts.verbose ? tx.sender : tx.sender.slice(0, config.address.shortLength),
      opts.verbose ? tx.recipient : tx.recipient.slice(0, config.address.shortLength),
      formatXE(tx.amount),
      tx.data.memo || '',
      tx.nonce.toString(),
      opts.verbose ? tx.signature : tx.signature.slice(0, config.signature.shortLength)
    ]
  )
  console.log(table(txs))
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('list-pending')
    .alias('lsp')
    .description('list pending transactions')
    .addHelpText('after', help)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = `
This command queries the blockchain and displays all of your pending transactions.
`
