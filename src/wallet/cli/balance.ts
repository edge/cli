import { Command } from 'commander'
import { Context } from '../..'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { formatXE } from '../../transaction/xe'

/** Display the current balance of the host wallet. */
export const action = ({ wallet, xe }: Context) => async (): Promise<void> => {
  const address = await wallet().address()
  const { balance } = await xe().wallet(address)

  console.log(`Address: ${address}`)
  console.log(`Balance: ${formatXE(balance)}`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('balance').description('check balance')
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action(ctx))))
  return cmd
}
