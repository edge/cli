// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as indexUtils from '@edge/index-utils'
import { Command } from 'commander'
import { Context } from '../../main'
import { checkVersionHandler } from '../../update/cli'
import config from '../../config'
import { errorHandler } from '../../cli'
import { formatXE } from '../xe'
import { formatTime, printTable } from '../../helpers'

/** List transactions for the host wallet. */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.verbose.read(ctx.parent)
  }

  const address = await ctx.wallet().address()
  const { results, metadata } = await ctx.indexClient().transactions(address, cli.pagination.read(ctx.cmd))
  if (results.length === 0) {
    console.log('No transactions')
    return
  }

  const numPages = Math.ceil(metadata.totalCount / metadata.limit)
  console.log(`Page ${metadata.page}/${numPages}`)
  console.log()

  const table = printTable<indexUtils.tx.Tx>(
    ['Time', 'Block', 'Tx', 'From', 'To', 'Amount', 'Memo', 'Nonce', 'Signature'],
    tx => [
      formatTime(tx.timestamp),
      tx.block.height.toString(),
      opts.verbose ? tx.hash : tx.hash.slice(0, config.hash.shortLength),
      opts.verbose ? tx.sender : tx.sender.slice(0, config.address.shortLength),
      opts.verbose ? tx.recipient : tx.recipient.slice(0, config.address.shortLength),
      formatXE(tx.amount),
      tx.data.memo || '',
      tx.nonce.toString(),
      opts.verbose ? tx.signature : tx.signature.slice(0, config.signature.shortLength)
    ]
  )
  console.log(table(results))
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('list').alias('ls').description('list transactions').addHelpText('after', help)
  cli.pagination.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

/** Help text for the `transaction list` command. */
const help = `
This command queries the index and displays your transactions.
`
