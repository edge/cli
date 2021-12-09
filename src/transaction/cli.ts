// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as index from '@edge/index-utils'
import * as walletCLI from '../wallet/cli'
import * as xe from '@edge/xe-utils'
import { Command } from 'commander'
import { ask } from '../input'
import { checkVersionHandler } from '../update/cli'
import { errorHandler } from '../edge/cli'
import { printData } from '../helpers'
import { withFile } from '../wallet/storage'
import { CommandContext, Context } from '../main'
import { askToSignTx, handleCreateTxResult, withNetwork as indexWithNetwork } from './index'
import { formatXE, parseAmount, withNetwork as xeWithNetwork } from './xe'

const formatIndexTx = (address: string, tx: index.tx.Tx): string => {
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

const formatTx = (address: string, tx: xe.tx.Tx): string => {
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

const listAction = ({ parent, cmd, network, ...ctx }: CommandContext) => async () => {
  const log = ctx.logger()

  const opts = {
    ...walletCLI.getWalletOption(parent, network),
    ...getListOptions(cmd)
  }
  log.debug('Options', opts)

  const address = await withFile(opts.wallet).address()
  const params = {
    page: opts.page,
    limit: opts.limit
  }

  log.info('Getting transactions', { host: network.index.baseURL, address, params })
  const response = await indexWithNetwork(network).transactions(address, params)
  log.debug('Response', { ...response })

  if (response.results.length === 0) {
    console.log('No transactions')
    return
  }

  const numPages = Math.ceil(response.metadata.totalCount / response.metadata.limit)
  console.log(`Page ${response.metadata.page}/${numPages}`)
  console.log()

  response.results
    .map(tx => formatIndexTx(address, tx))
    .forEach(tx => {
      console.log(tx)
      console.log()
    })
}

const listHelp = [
  '\n',
  'This command queries the index and displays your transactions.'
].join('')

const listPendingAction = ({ parent, network, ...ctx }: CommandContext) => async () => {
  const log = ctx.logger()

  const opts = {
    ...walletCLI.getWalletOption(parent, network)
  }
  log.debug('Options', opts)

  const address = await withFile(opts.wallet).address()

  log.info('Getting pending transactions', { address })
  const txs = await xeWithNetwork(network).pendingTransactions(address)
  log.debug('Transactions', { txs })

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
const sendAction = ({ parent, cmd, network, ...ctx }: CommandContext) => async (amountInput: string, recipient: string) => {
  const log = ctx.logger()

  const opts = {
    ...walletCLI.getWalletOption(parent, network),
    ...walletCLI.getPassphraseOption(cmd),
    ...(() => {
      const { memo, yes } = cmd.opts<{ memo?: string, yes: boolean }>()
      return { memo, yes }
    })()
  }
  log.debug('Options', opts)

  const amount = parseAmount(amountInput)
  if (!xe.wallet.validateAddress(recipient)) throw new Error('invalid recipient')

  const storage = withFile(opts.wallet)
  const address = await storage.address()

  const api = xeWithNetwork(network)
  log.info('Getting wallet info', { host: network.blockchain.baseURL, address })
  const onChainWallet = await api.walletWithNextNonce(address)
  log.debug('Wallet info', onChainWallet)

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
  log.info('Decrypting wallet', { file: opts.wallet })
  const wallet = await storage.read(opts.passphrase as string)

  const data: xe.tx.TxData = {}
  if (opts.memo) data.memo = opts.memo
  const tx = xe.tx.sign({
    timestamp: Date.now(),
    sender: address,
    recipient,
    amount,
    data,
    nonce: onChainWallet.nonce
  }, wallet.privateKey)

  log.info('Creating transaction', { tx })
  const result = await api.createTransaction(tx)
  log.debug('Response', { ...result })
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
