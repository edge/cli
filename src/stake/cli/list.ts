import * as cli from '../../cli'
import * as indexUtils from '@edge/index-utils'
import { Command } from 'commander'
import { byPrecedence } from '..'
import { checkVersionHandler } from '../../update/cli'
import config from '../../config'
import { errorHandler } from '../../cli'
import { formatXE } from '../../transaction/xe'
import { CommandContext, Context } from '../..'
import { formatTime, printTable, toUpperCaseFirst } from '../../helpers'

/**
 * List stakes associated with the host wallet (`stake list`).
 */
export const action = (ctx: CommandContext) => async (): Promise<void> => {
  const opts = {
    ...cli.verbose.read(ctx.parent)
  }

  const storage = ctx.wallet()
  const address = await storage.address()
  const { results: stakes } = await ctx.indexClient().stakes(address, { limit: 999 })

  const table = printTable<indexUtils.stake.AddressedStake>(
    ['Type', 'ID', 'Hash', 'Created', 'Tx', 'Amount', 'Status'],
    stake => [
      toUpperCaseFirst(stake.type),
      opts.verbose ? stake.id : stake.id.slice(0, config.id.shortLength),
      opts.verbose ? stake.hash : stake.hash.slice(0, config.hash.shortLength),
      formatTime(stake.created),
      opts.verbose ? stake.transaction : stake.transaction.slice(0, config.hash.shortLength),
      formatXE(stake.amount),
      (() => {
        if (stake.released !== undefined) return 'Released'
        if (stake.unlockRequested !== undefined) {
          const unlockAt = stake.unlockRequested + stake.unlockPeriod
          if (unlockAt > Date.now()) return `Unlocking (unlocks at ${formatTime(unlockAt)})`
          return 'Unlocked'
        }
        return 'Active'
      })()
    ]
  )
  console.log(table(stakes.sort(byPrecedence)))
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('list').alias('ls').description('list all stakes').addHelpText('after', help)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = `
Displays all stakes associated with your wallet.
`
