import { Command } from 'commander'
import { getOptions as getGlobalOptions } from '../edge/cli'
import { getOptions as getWalletOptions } from '../wallet/cli'
import { readWallet } from '../wallet/storage'
import { transactions } from './api'

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
    ...getWalletOptions(parent),
    ...getListOptions(listCmd)
  }
  if (opts.verbose) console.debug(opts)

  const wallet = await readWallet(opts.walletFile)
  const txs = await transactions(wallet.address, opts.page, opts.perPage)
  console.log(txs)
}

export const withProgram = (parent: Command): void => {
  const transactionCLI = new Command('transaction')
    .alias('tx')
    .description('manage transactions')

  // edge transaction ls
  const list = new Command('ls')
    .description('list transactions')
    .option('-p, --page <n>', 'page number', '1')
    .option('-l, --per-page <n>', 'transactions per page', '5')
  list.action(listAction(parent, list))

  transactionCLI
    .addCommand(list)

  parent.addCommand(transactionCLI)
}
