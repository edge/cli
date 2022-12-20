import * as cli from '../../cli'
import * as xeUtils from '@edge/xe-utils'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import config from '../../config'
import { errorHandler } from '../../cli'
import { formatXE } from '../xe'
import { CommandContext, Context } from '../..'
import { formatTime, printTable } from '../../helpers'

/** List pending transactions for the host wallet (`transaction list-pending`). */
export const action = ({ wallet, xe, ...ctx }: CommandContext) => async (): Promise<void> => {
  const { verbose } = cli.verbose.read(ctx.parent)

  const address = await wallet().address()

  const txs = await xe().pendingTransactions(address)
  if (txs.length === 0) {
    console.log('No pending transactions')
    return
  }

  const table = printTable<xeUtils.tx.Tx>(
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

export const command = (ctx: Context): Command => {
  const cmd = new Command('list-pending')
    .alias('lsp')
    .description('list pending transactions')
    .addHelpText('after', help)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = `
This command queries the blockchain and displays all of your pending transactions.
`
