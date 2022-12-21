// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as repl from '../../repl'
import * as xeUtils from '@edge/xe-utils'
import { Command } from 'commander'
import { Context } from '../../main'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { askToSignTx, handleCreateTxResult } from '..'
import { formatXE, parseAmount } from '../xe'

/** Send an XE transaction via the blockchain. */
export const action = (ctx: Context) => async (amountInput: string, recipient: string): Promise<void> => {
  const opts = {
    ...await cli.passphrase.read(ctx.cmd),
    ...cli.memo.read(ctx.cmd),
    ...cli.yes.read(ctx.cmd)
  }

  const amount = parseAmount(amountInput)
  if (!xeUtils.wallet.validateAddress(recipient)) throw new Error('invalid recipient')

  const wallet = ctx.wallet()
  const address = await wallet.address()

  const xeClient = ctx.xeClient()
  let onChainWallet = await xeClient.wallet(address)
  const pendingTxsAmount = (await xeClient.pendingTransactions(address)).reduce((amt, tx) => amt + tx.amount, 0)
  const availableBalance = onChainWallet.balance - pendingTxsAmount

  const resultBalance = availableBalance - amount
  // eslint-disable-next-line max-len
  if (resultBalance < 0) throw new Error(`insufficient balance: your wallet only contains ${formatXE(availableBalance)}`)

  if (!opts.yes) {
    repl.echo(`
    You are sending ${formatXE(amount)} to ${recipient}${opts.memo ? ` with the memo, "${opts.memo}"` : ''}.
    ${formatXE(amount)} will be deducted from your wallet. You will have ${formatXE(resultBalance)} remaining.
    `)
    if (await repl.askLetter('Proceed with transaction?', 'yn') === 'n') return
    repl.nl()
  }

  await askToSignTx(opts)
  repl.nl()
  const hostWallet = await wallet.read(opts.passphrase as string)
  onChainWallet = await xeClient.walletWithNextNonce(address)

  const data: xeUtils.tx.TxData = {}
  if (opts.memo) data.memo = opts.memo
  const tx = xeUtils.tx.sign({
    timestamp: Date.now(),
    sender: address,
    recipient,
    amount,
    data,
    nonce: onChainWallet.nonce
  }, hostWallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(ctx.network, result)) process.exitCode = 1
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('send')
    .argument('<amount>', 'amount in XE or mXE')
    .argument('<wallet>', 'recipient wallet address')
    .description('send XE to another wallet')
    .addHelpText('after', help)
  cli.memo.configure(cmd)
  cli.passphrase.configure(cmd)
  cli.yes.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = repl.help(`
This command sends an XE transaction to any address you choose. <amount> may be specified as XE in the format "...xe" or as microXE in the format "...mxe" (both case-insensitive). If no unit is provided, XE is assumed.

Your private key will be used to sign the transaction. You must provide a passphrase to decrypt your private key.
`)
