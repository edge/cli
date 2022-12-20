import { Command } from 'commander'
import { Context } from '../..'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { formatXE } from '../../transaction/xe'

/** Display the current balance of the host wallet. */
export const action = (ctx: Context) => async (): Promise<void> => {
  const address = await ctx.wallet().address()
  const { balance } = await ctx.xeClient().wallet(address)

  console.log(`Address: ${address}`)
  console.log(`Balance: ${formatXE(balance)}`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('balance').description('check balance')
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action(ctx))))
  return cmd
}