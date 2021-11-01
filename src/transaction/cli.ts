// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as index from '@edge/index-utils'
import * as walletCLI from '../wallet/cli'
import * as xe from '@edge/xe-utils'
import { Network } from '../main'
import { ask } from '../input'
import { errorHandler } from '../edge/cli'
import { Command, Option } from 'commander'
import { askToSignTx, withNetwork as indexWithNetwork } from './index'
import { decryptFileWallet, readWallet } from '../wallet/storage'
import { formatXE, parseAmount, withNetwork as xeWithNetwork } from './xe'

const formatIndexTx = (address: string, tx: index.Tx): string => {
  const lines: string[] = [
    `Tx: ${tx.hash}`,
    `Nonce: ${tx.nonce} Block: ${tx.block.height} At: ` + formatTimestamp(new Date(tx.timestamp))
  ]
  if (tx.sender === address) lines.push(`To: ${tx.recipient}`)
  else lines.push(`From: ${tx.sender}`)
  lines.push(`Amount: ${formatXE(tx.amount)}`)
  const dataKeys = Object.keys(tx.data) as (keyof index.TxData)[]
  if (dataKeys.length) {
    lines.push('Data:')
    dataKeys.forEach(key => {
      lines.push(`  ${key}: ${tx.data[key]}`)
    })
  }
  lines.push(`Signature: ${tx.signature}`)
  return lines.join('\n')
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
  const lines: string[] = [
    `Tx: ${tx.hash}`,
    `Nonce: ${tx.nonce} At: ` + formatTimestamp(new Date(tx.timestamp))
  ]
  if (tx.sender === address) lines.push(`To: ${tx.recipient}`)
  else lines.push(`From: ${tx.sender}`)
  lines.push(`Amount: ${formatXE(tx.amount)}`)
  const dataKeys = Object.keys(tx.data) as (keyof index.TxData)[]
  if (dataKeys.length) {
    lines.push('Data:')
    dataKeys.forEach(key => {
      lines.push(`  ${key}: ${tx.data[key]}`)
    })
  }
  lines.push(`Signature: ${tx.signature}`)
  return lines.join('\n')
}

const getListOptions = (listCmd: Command) => {
  type ListOptions<T = number> = { page: T, limit: T }
  const opts = listCmd.opts<ListOptions<string>>()
  return <ListOptions>{
    page: parseInt(opts.page),
    limit: parseInt(opts.limit)
  }
}

const listAction = (parent: Command, listCmd: Command, network: Network) => async () => {
  const opts = {
    ...walletCLI.getWalletOption(parent),
    ...getJsonOption(listCmd),
    ...getListOptions(listCmd)
  }

  const wallet = await readWallet(opts.wallet)
  const response = await indexWithNetwork(network).transactions(wallet.address, {
    page: opts.page,
    limit: opts.limit
  })

  if (opts.json) {
    console.log(JSON.stringify(response, undefined, 2))
    return
  }

  if (response.results.length === 0) {
    console.log('No transactions')
    return
  }

  const numPages = Math.ceil(response.metadata.totalCount / response.metadata.limit)
  console.log(`Page ${response.metadata.page}/${numPages}`)
  console.log()

  response.results
    .map(tx => formatIndexTx(wallet.address, tx))
    .forEach(tx => {
      console.log(tx)
      console.log()
    })
}

const listHelp = [
  '\n',
  'This command queries the index and displays your transactions.'
].join('')

const listPendingAction = (parent: Command, listPendingCmd: Command, network: Network) => async () => {
  const opts = {
    ...walletCLI.getWalletOption(parent),
    ...getJsonOption(listPendingCmd)
  }

  const wallet = await readWallet(opts.wallet)
  const txs = await xeWithNetwork(network).pendingTransactions(wallet.address)

  if (opts.json) {
    console.log(JSON.stringify(txs, undefined, 2))
    return
  }

  if (txs.length === 0) {
    console.log('No pending transactions')
    return
  }

  txs.map(tx => formatTx(wallet.address, tx))
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
const sendAction = (parent: Command, sendCmd: Command, network: Network) => async (amountInput: string, recipient: string) => {
  const opts = {
    ...walletCLI.getWalletOption(parent),
    ...walletCLI.getPassphraseOption(sendCmd),
    ...(() => {
      const { memo, yes } = sendCmd.opts<{ memo?: string, yes: boolean }>()
      return { memo, yes }
    })()
  }

  const amount = parseAmount(amountInput)
  if (!xe.wallet.validateAddress(recipient)) throw new Error('invalid recipient')

  const encWallet = await readWallet(opts.wallet)

  const api = xeWithNetwork(network)
  const onChainWallet = await api.walletWithNextNonce(encWallet.address)
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
  const wallet = decryptFileWallet(encWallet, opts.passphrase as string)

  const data: xe.tx.TxData = {}
  if (opts.memo) data.memo = opts.memo
  const tx = xe.tx.sign({
    timestamp: Date.now(),
    sender: wallet.address,
    recipient,
    amount,
    data,
    nonce: onChainWallet.nonce
  }, wallet.privateKey)

  const result = await api.createTransaction(tx)
  if (result.metadata.accepted !== 1) {
    console.log('There was a problem creating your transaction. The response from the blockchain is shown below:')
    console.log()
    console.log(JSON.stringify(result, undefined, 2))
    process.exitCode = 1
  }
  else {
    console.log('Your transaction has been submitted and will appear in the explorer shortly.')
    console.log()
    console.log(`${network.explorer.baseURL}/transaction/${result.results[0].hash}`)
  }
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

const getJsonOption = (cmd: Command) => {
  type JsonOption = { json: boolean }
  const { json } = cmd.opts<JsonOption>()
  return <JsonOption>{ json }
}

const jsonOption = () => new Option('--json', 'display results as json')

export const withProgram = (parent: Command, network: Network): void => {
  const transactionCLI = new Command('transaction')
    .alias('tx')
    .description('manage transactions')

  // edge transaction list
  const list = new Command('list')
    .alias('ls')
    .description('list transactions')
    .addHelpText('after', listHelp)
    .addOption(jsonOption())
    .option('-p, --page <n>', 'page number', '1')
    .option('-l, --limit <n>', 'transactions per page', '10')
  list.action(errorHandler(parent, listAction(parent, list, network)))

  // edge transaction list-pending
  const listPending = new Command('list-pending')
    .alias('lsp')
    .description('list pending transactions')
    .addHelpText('after', listPendingHelp)
    .addOption(jsonOption())
  listPending.action(errorHandler(parent, listPendingAction(parent, listPending, network)))

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
  send.action(errorHandler(parent, sendAction(parent, send, network)))

  transactionCLI
    .addCommand(list)
    .addCommand(listPending)
    .addCommand(send)

  parent.addCommand(transactionCLI)
}
