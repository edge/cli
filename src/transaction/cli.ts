// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { checkVersionHandler } from '../update/cli'
import config from '../config'
import { tx as indexTx } from '@edge/index-utils'
import { Command, Option } from 'commander'
import { CommandContext, Context } from '..'
import { askLetter, getPaginationOptions, getYesOption, limitOption, pageOption, yesOption } from '../input'
import { askToSignTx, handleCreateTxResult } from './index'
import { errorHandler, getVerboseOption } from '../edge/cli'
import { formatTime, printTable } from '../helpers'
import { formatXE, parseAmount } from './xe'
import { getPassphraseOption, passphraseFileOption, passphraseOption } from '../wallet/cli'
import { tx as xeTx, wallet as xeWallet } from '@edge/xe-utils'

/**
 * List transactions for the host wallet (`transaction list`).
 */
const listAction = ({ index, wallet, ...ctx }: CommandContext) => async () => {
  const { verbose } = getVerboseOption(ctx.parent)

  const address = await wallet().address()
  const { results, metadata } = await index().transactions(address, getPaginationOptions(ctx.cmd))
  if (results.length === 0) {
    console.log('No transactions')
    return
  }

  const numPages = Math.ceil(metadata.totalCount / metadata.limit)
  console.log(`Page ${metadata.page}/${numPages}`)
  console.log()

  const table = printTable<indexTx.Tx>(
    ['Time', 'Block', 'Tx', 'From', 'To', 'Amount', 'Memo', 'Nonce', 'Signature'],
    tx => [
      formatTime(tx.timestamp),
      tx.block.height.toString(),
      verbose ? tx.hash : tx.hash.slice(0, config.hash.shortLength),
      verbose ? tx.sender : tx.sender.slice(0, config.address.shortLength),
      verbose ? tx.recipient : tx.recipient.slice(0, config.address.shortLength),
      formatXE(tx.amount),
      tx.data.memo || '',
      tx.nonce.toString(),
      verbose ? tx.signature : tx.signature.slice(0, config.signature.shortLength)
    ]
  )
  console.log(table(results))
}

/** Help text for the `transaction list` command. */
const listHelp = [
  '\n',
  'This command queries the index and displays your transactions.'
].join('')

/** List pending transactions for the host wallet (`transaction list-pending`). */
const listPendingAction = ({ wallet, xe, ...ctx }: CommandContext) => async () => {
  const { verbose } = getVerboseOption(ctx.parent)

  const address = await wallet().address()

  const txs = await xe().pendingTransactions(address)
  if (txs.length === 0) {
    console.log('No pending transactions')
    return
  }

  const table = printTable<xeTx.Tx>(
    ['Time', 'Tx', 'From', 'To', 'Amount', 'Memo', 'Nonce', 'Signature'],
    tx => [
      formatTime(tx.timestamp),
      verbose ? tx.hash : tx.hash.slice(0, config.hash.shortLength),
      verbose ? tx.sender : tx.sender.slice(0, config.address.shortLength),
      verbose ? tx.recipient : tx.recipient.slice(0, config.address.shortLength),
      formatXE(tx.amount),
      tx.data.memo || '',
      tx.nonce.toString(),
      verbose ? tx.signature : tx.signature.slice(0, config.signature.shortLength)
    ]
  )
  console.log(table(txs))
}

/** Help text for the `transaction list-pending` command. */
const listPendingHelp = [
  '\n',
  'This command queries the blockchain and displays all of your pending transactions.'
].join('')

/**
 * Send an XE transaction via the blockchain (`transaction send`).
 */
// eslint-disable-next-line max-len
const sendAction = ({ logger, wallet, xe, ...ctx }: CommandContext) => async (amountInput: string, recipient: string) => {
  const log = logger()

  const opts = {
    ...await getPassphraseOption(ctx.cmd),
    ...getMemoOption(ctx.cmd),
    ...getYesOption(ctx.cmd)
  }
  log.debug('options', opts)

  const amount = parseAmount(amountInput)
  if (!xeWallet.validateAddress(recipient)) throw new Error('invalid recipient')

  const storage = wallet()
  const address = await storage.address()

  const xeClient = xe()
  let onChainWallet = await xeClient.wallet(address)

  const resultBalance = onChainWallet.balance - amount
  // eslint-disable-next-line max-len
  if (resultBalance < 0) throw new Error(`insufficient balance: your wallet only contains ${formatXE(onChainWallet.balance)}`)

  if (!opts.yes) {
    // eslint-disable-next-line max-len
    console.log(`You are sending ${formatXE(amount)} to ${recipient}${opts.memo ? ` with the memo, "${opts.memo}"` : ''}.`)
    console.log(
      `${formatXE(amount)} will be deducted from your wallet.`,
      `You will have ${formatXE(resultBalance)} remaining.`
    )
    console.log()
    if (await askLetter('Proceed with transaction?', 'yn') === 'n') return
    console.log()
  }

  await askToSignTx(opts)
  const userWallet = await storage.read(opts.passphrase as string)
  onChainWallet = await xeClient.walletWithNextNonce(address)

  const data: xeTx.TxData = {}
  if (opts.memo) data.memo = opts.memo
  const tx = xeTx.sign({
    timestamp: Date.now(),
    sender: address,
    recipient,
    amount,
    data,
    nonce: onChainWallet.nonce
  }, userWallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(ctx.network, result)) process.exitCode = 1
}

/** Help text for the `transaction send` command. */
const sendHelp = [
  '\n',
  'This command sends an XE transaction to any address you choose. ',
  // eslint-disable-next-line max-len
  '<amount> may be specified as XE in the format "...xe" or as microXE in the format "...mxe" (both case-insensitive). ',
  'If no unit is provided, XE is assumed.\n\n',
  'Your private key will be used to sign the transaction. ',
  'You must provide a passphrase to decrypt your private key.'
].join('')

/** Get transaction memo from user command. */
const getMemoOption = (cmd: Command): { memo?: string } => {
  const { memo } = cmd.opts<{ memo?: string }>()
  return { memo }
}

/** Create transaction memo option for CLI. */
const memoOption = (description = 'attach a memo to the transaction') => new Option('-m, --memo <text>', description)

/**
 * Configure `transaction` commands with root context.
 */
export const withContext = (ctx: Context): Command => {
  const transactionCLI = new Command('transaction')
    .alias('tx')
    .description('manage transactions')

  // edge transaction list
  const list = new Command('list')
    .alias('ls')
    .description('list transactions')
    .addHelpText('after', listHelp)
    .addOption(pageOption())
    .addOption(limitOption())
  list.action(errorHandler(ctx, checkVersionHandler(ctx, listAction({ ...ctx, cmd: list }))))

  // edge transaction list-pending
  const listPending = new Command('list-pending')
    .alias('lsp')
    .description('list pending transactions')
    .addHelpText('after', listPendingHelp)
  listPending.action(errorHandler(ctx, checkVersionHandler(ctx, listPendingAction({ ...ctx, cmd: listPending }))))

  // edge transaction send
  const send = new Command('send')
    .argument('<amount>', 'amount in XE or mXE')
    .argument('<wallet>', 'recipient wallet address')
    .description('send XE to another wallet')
    .addHelpText('after', sendHelp)
    .addOption(memoOption())
    .addOption(passphraseOption())
    .addOption(passphraseFileOption())
    .addOption(yesOption())
  send.action(errorHandler(ctx, checkVersionHandler(ctx, sendAction({ ...ctx, cmd: send }))))

  transactionCLI
    .addCommand(list)
    .addCommand(listPending)
    .addCommand(send)

  return transactionCLI
}
