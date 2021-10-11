
import * as xe from '@edge/xe-utils'
import { Command } from 'commander'
import { withNetwork as indexWithNetwork } from './index'
import { withNetwork as xeWithNetwork } from './xe'
import { addSecretKeyOption, getSecretKeyOption, getWalletOption } from '../wallet/cli'
import { errorHandler, getOptions as getGlobalOptions } from '../edge/cli'
import { readWallet, withFile } from '../wallet/storage'

type ListOptions<T = number> = {
  page: T
  perPage: T
}

type SendOptions = {
  memo?: string
}

const mxeAmountRegexp = /^(\d+) ?mxe$/i
const xeAmountRegexp = /^(\d+)( ?xe)?$/i

const getListOptions = (listCmd: Command): ListOptions => {
  const opts = listCmd.opts<ListOptions<string>>()
  return {
    page: parseInt(opts.page),
    perPage: parseInt(opts.perPage)
  }
}

const listAction = (parent: Command, listCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...getWalletOption(parent),
    ...getListOptions(listCmd)
  }
  if (opts.verbose) console.debug(opts)

  const wallet = await readWallet(opts.wallet)
  const txs = await indexWithNetwork(opts.network).transactions(wallet.address, {
    page: opts.page,
    limit: opts.perPage
  })
  console.log(txs)
}

const listPendingAction = (parent: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...getWalletOption(parent)
  }
  if (opts.verbose) console.debug(opts)

  const wallet = await readWallet(opts.wallet)
  const txs = await xeWithNetwork(opts.network).pendingTransactions(wallet.address)
  console.log(txs)
}

const sendAction = (parent: Command, sendCmd: Command) => async (amountInput: string, recipient: string) => {
  const opts = {
    ...getGlobalOptions(parent),
    ...getSendOptions(sendCmd),
    ...getWalletOption(parent),
    ...await getSecretKeyOption(sendCmd)
  }

  if (!xe.wallet.validateAddress(recipient)) throw new Error('invalid recipient')

  const [read] = withFile(opts.wallet)
  const localWallet = await read(opts.secretKey)
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

const parseAmount = (amount: string): number => {
  if (mxeAmountRegexp.test(amount)) {
    const m = amount.match(mxeAmountRegexp)
    if (m === null) throw new Error(`failed to parse mXE amount from "${amount}"`)
    return parseInt(m[1])
  }
  if (xeAmountRegexp.test(amount)) {
    const m = amount.match(xeAmountRegexp)
    if (m === null) throw new Error(`failed to parse XE amount from "${amount}"`)
    return parseInt(m[1]) * 1e6
  }
  throw new Error(`invalid amount "${amount}"`)
}

export const getSendOptions = (sendCmd: Command): SendOptions => {
  const opts = sendCmd.opts<SendOptions>()
  return {
    memo: opts.memo
  }
}

export const withProgram = (parent: Command): void => {
  const transactionCLI = new Command('transaction')
    .alias('tx')
    .description('manage transactions')

  // edge transaction list
  const list = new Command('list')
    .alias('ls')
    .description('list transactions')
    .option('-p, --page <n>', 'page number', '1')
    .option('-l, --per-page <n>', 'transactions per page', '5')
  list.action(errorHandler(parent, listAction(parent, list)))

  // edge transaction list-pending
  const listPending = new Command('list-pending')
    .alias('lsp')
    .description('list pending transactions')
  listPending.action(errorHandler(parent, listPendingAction(parent)))

  // edge transaction send
  const send = new Command('send')
    .argument('<amount>', 'amount in XE')
    .argument('<wallet>', 'recipient wallet address')
    .description('send XE to another wallet')
    .option('-m, --memo <text>', 'attach a memo to the transaction')
  addSecretKeyOption(send)
  send.action(errorHandler(parent, sendAction(parent, send)))

  transactionCLI
    .addCommand(list)
    .addCommand(listPending)
    .addCommand(send)

  parent.addCommand(transactionCLI)
}
