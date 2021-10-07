import { Command } from 'commander'
import { addSecretKeyOption, getSecretKeyOption, getWalletOption } from '../wallet/cli'
import { readWallet } from '../wallet/storage'
import { transactions } from './api'
import { errorHandler, getOptions as getGlobalOptions } from '../edge/cli'

type ListOptions<T = number> = {
  page: T
  perPage: T
}

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
  const txs = await transactions(opts.network, wallet.address, opts.page, opts.perPage)
  console.log(txs)
}

const sendAction = (parent: Command, sendCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...getWalletOption(parent),
    ...await getSecretKeyOption(sendCmd)
  }

  console.log('WIP', opts)
}

export const withProgram = (parent: Command): void => {
  const transactionCLI = new Command('transaction')
    .alias('tx')
    .description('manage transactions')

  // edge transaction ls
  const list = new Command('list')
    .alias('ls')
    .description('list transactions')
    .option('-p, --page <n>', 'page number', '1')
    .option('-l, --per-page <n>', 'transactions per page', '5')
  list.action(errorHandler(parent, listAction(parent, list)))

  const send = new Command('send')
    .argument('<amount>', 'amount in XE')
    .argument('<wallet>', 'recipient wallet address')
    .description('send XE to another wallet')
    .option('-m, --memo <text>', 'attach a memo to the transaction')
  addSecretKeyOption(send)
  send.action(errorHandler(parent, sendAction(parent, send)))

  transactionCLI
    .addCommand(list)
    .addCommand(send)

  parent.addCommand(transactionCLI)
}
