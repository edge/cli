import * as index from '@edge/index-utils'
import * as walletCLI from '../wallet/cli'
import * as xe from '@edge/xe-utils'
import { withNetwork as indexWithNetwork } from './index'
import { Command, Option } from 'commander'
import { errorHandler, getOptions as getGlobalOptions } from '../edge/cli'
import { formatXE, parseAmount, withNetwork as xeWithNetwork } from './xe'
import { readWallet, withFile } from '../wallet/storage'

const formatIndexTx = (address: string, tx: index.Tx): string => {
  const lines: string[] = [
    `Tx: ${tx.nonce} Block: ${tx.block.height} At: ` + formatTimestamp(new Date(tx.timestamp))
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
    `Tx: ${tx.nonce} At: ` + formatTimestamp(new Date(tx.timestamp))
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

const listAction = (parent: Command, listCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...walletCLI.getWalletOption(parent),
    ...getJsonOption(listCmd),
    ...getListOptions(listCmd)
  }

  const wallet = await readWallet(opts.wallet)
  const response = await indexWithNetwork(opts.network).transactions(wallet.address, {
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

const listPendingAction = (parent: Command, listPendingCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...walletCLI.getWalletOption(parent),
    ...getJsonOption(listPendingCmd)
  }
  if (opts.verbose) console.debug(opts)

  const wallet = await readWallet(opts.wallet)
  const txs = await xeWithNetwork(opts.network).pendingTransactions(wallet.address)

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

const sendAction = (parent: Command, sendCmd: Command) => async (amountInput: string, recipient: string) => {
  const opts = {
    ...getGlobalOptions(parent),
    ...walletCLI.getWalletOption(parent),
    ...walletCLI.getPassphraseOption(sendCmd),
    ...(() => {
      const opts = sendCmd.opts<{ memo?: string }>()
      return { memo: opts.memo }
    })()
  }

  if (!xe.wallet.validateAddress(recipient)) throw new Error('invalid recipient')

  const { read } = withFile(opts.wallet)
  const localWallet = await read(opts.passphrase || '')
  const api = xeWithNetwork(opts.network)
  const wallet = await api.walletWithNextNonce(localWallet.address)

  const data: xe.tx.TxData = {}
  if (opts.memo) data.memo = opts.memo
  const amount = parseAmount(amountInput)
  const tx = xe.tx.sign({
    timestamp: Date.now(),
    sender: wallet.address,
    recipient,
    amount,
    data,
    nonce: wallet.nonce
  }, localWallet.privateKey)

  const result = await api.createTransaction(tx)
  console.log(result)
}

const getJsonOption = (cmd: Command) => {
  type JsonOption = { json: boolean }
  const { json } = cmd.opts<JsonOption>()
  return <JsonOption>{ json }
}

const jsonOption = () => new Option('--json', 'display results as json')

export const withProgram = (parent: Command): void => {
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
  list.action(errorHandler(parent, listAction(parent, list)))

  // edge transaction list-pending
  const listPending = new Command('list-pending')
    .alias('lsp')
    .description('list pending transactions')
    .addHelpText('after', listPendingHelp)
    .addOption(jsonOption())
  listPending.action(errorHandler(parent, listPendingAction(parent, listPending)))

  // edge transaction send
  const send = new Command('send')
    .argument('<amount>', 'amount in XE')
    .argument('<wallet>', 'recipient wallet address')
    .description('send XE to another wallet')
    .option('-m, --memo <text>', 'attach a memo to the transaction')
    .addOption(walletCLI.passphraseOption())
    .addOption(walletCLI.passphraseFileOption())
  send.action(errorHandler(parent, sendAction(parent, send)))

  transactionCLI
    .addCommand(list)
    .addCommand(listPending)
    .addCommand(send)

  parent.addCommand(transactionCLI)
}
