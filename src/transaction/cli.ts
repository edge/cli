// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as walletCLI from '../wallet/cli'
import { Command } from 'commander'
import { ask } from '../input'
import { checkVersionHandler } from '../update/cli'
import { errorHandler } from '../edge/cli'
import { tx as indexTx } from '@edge/index-utils'
import { printData } from '../helpers'
import { withFile } from '../wallet/storage'
import { CommandContext, Context } from '..'
import { askToSignTx, handleCreateTxResult } from './index'
import { formatXE, parseAmount } from './xe'
import { tx as xeTx, wallet as xeWallet } from '@edge/xe-utils'

const formatIndexTx = (address: string, tx: indexTx.Tx): string => {
  const data: Record<string, string> = {
    Tx: tx.hash,
    Nonce: tx.nonce.toString(),
    Block: tx.block.height.toString(),
    At: formatTimestamp(new Date(tx.timestamp))
  }
  if (tx.sender === address) data.To = tx.recipient
  else data.From = tx.sender
  data.Amount = formatXE(tx.amount)
  if (tx.data.memo !== undefined) data.Memo = tx.data.memo
  data.Signature = tx.signature
  return printData(data)
}

const formatTimestamp = (d: Date): string => {
  const year = d.getFullYear().toString()
  const month = d.getMonth().toString().padStart(2, '0')
  const day = d.getDay().toString().padStart(2, '0')
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const s = d.getSeconds().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${h}:${m}:${s}`
}

const formatTx = (address: string, tx: xeTx.Tx): string => {
  const data: Record<string, string> = {
    Tx: tx.hash,
    Nonce: tx.nonce.toString(),
    At: formatTimestamp(new Date(tx.timestamp))
  }
  if (tx.sender === address) data.To = tx.recipient
  else data.From = tx.sender
  data.Amount = formatXE(tx.amount)
  if (tx.data.memo !== undefined) data.Memo = tx.data.memo
  data.Signature = tx.signature
  return printData(data)
}

const getListOptions = (cmd: Command) => {
  type ListOptions<T = number> = { page: T, limit: T }
  const opts = cmd.opts<ListOptions<string>>()
  return <ListOptions>{
    page: parseInt(opts.page),
    limit: parseInt(opts.limit)
  }
}

const listAction = ({ index, logger, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const opts = {
    ...walletCLI.getWalletOption(ctx.parent, ctx.network),
    list: getListOptions(ctx.cmd)
  }
  log.debug('options', opts)

  const address = await withFile(opts.wallet).address()
  const { results, metadata } = await index().transactions(address, opts.list)
  if (results.length === 0) {
    console.log('No transactions')
    return
  }

  const numPages = Math.ceil(metadata.totalCount / metadata.limit)
  console.log(`Page ${metadata.page}/${numPages}`)
  console.log()

  results.map(tx => formatIndexTx(address, tx)).forEach(tx => {
    console.log(tx)
    console.log()
  })
}

const listHelp = [
  '\n',
  'This command queries the index and displays your transactions.'
].join('')

const listPendingAction = ({ logger, xe, ...ctx }: CommandContext) => async () => {
  const { parent, network } = ctx
  const log = logger()

  const opts = {
    ...walletCLI.getWalletOption(parent, network)
  }
  log.debug('options', opts)

  const address = await withFile(opts.wallet).address()

  const txs = await xe().pendingTransactions(address)
  if (txs.length === 0) {
    console.log('No pending transactions')
    return
  }

  txs.map(tx => formatTx(address, tx))
    .forEach(tx => {
      console.log(tx)
      console.log()
    })
}

const listPendingHelp = [
  '\n',
  'This command queries the blockchain and displays all of your pending transactions.'
].join('')

// eslint-disable-next-line max-len
const sendAction = ({ logger, xe, ...ctx }: CommandContext) => async (amountInput: string, recipient: string) => {
  const { parent, cmd, network } = ctx
  const log = logger()

  const opts = {
    ...walletCLI.getWalletOption(parent, network),
    ...walletCLI.getPassphraseOption(cmd),
    ...(() => {
      const { memo, yes } = cmd.opts<{ memo?: string, yes: boolean }>()
      return { memo, yes }
    })()
  }
  log.debug('options', opts)

  const amount = parseAmount(amountInput)
  if (!xeWallet.validateAddress(recipient)) throw new Error('invalid recipient')

  const storage = withFile(opts.wallet)
  const address = await storage.address()

  const xeClient = xe()
  const onChainWallet = await xeClient.walletWithNextNonce(address)

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
    let confirm = ''
    const ynRegexp = /^[yn]$/
    while (confirm.length === 0) {
      const input = await ask('Proceed with transaction? [yn] ')
      if (ynRegexp.test(input)) confirm = input
      else console.log('Please enter y or n.')
    }
    if (confirm === 'n') return
    console.log()
  }

  await askToSignTx(opts)
  log.debug('Decrypting wallet', { file: opts.wallet })
  const wallet = await storage.read(opts.passphrase as string)

  const data: xeTx.TxData = {}
  if (opts.memo) data.memo = opts.memo
  const tx = xeTx.sign({
    timestamp: Date.now(),
    sender: address,
    recipient,
    amount,
    data,
    nonce: onChainWallet.nonce
  }, wallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(network, result)) process.exitCode = 1
}

const sendHelp = [
  '\n',
  'This command sends an XE transaction to any address you choose. ',
  // eslint-disable-next-line max-len
  '<amount> may be specified as XE in the format "...xe" or as microXE in the format "...mxe" (both case-insensitive). ',
  'If no unit is provided, XE is assumed.\n\n',
  'Your private key will be used to sign the transaction. ',
  'You must provide a passphrase to decrypt your private key.'
].join('')

export const withContext = (ctx: Context): Command => {
  const transactionCLI = new Command('transaction')
    .alias('tx')
    .description('manage transactions')

  // edge transaction list
  const list = new Command('list')
    .alias('ls')
    .description('list transactions')
    .addHelpText('after', listHelp)
    .option('-p, --page <n>', 'page number', '1')
    .option('-l, --limit <n>', 'transactions per page', '10')
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
    .option('-m, --memo <text>', 'attach a memo to the transaction')
    .addOption(walletCLI.passphraseOption())
    .addOption(walletCLI.passphraseFileOption())
    .option('-y, --yes', 'do not ask for confirmation')
  send.action(errorHandler(ctx, checkVersionHandler(ctx, sendAction({ ...ctx, cmd: send }))))

  transactionCLI
    .addCommand(list)
    .addCommand(listPending)
    .addCommand(send)

  return transactionCLI
}
