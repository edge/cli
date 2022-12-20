import * as cli from '../../cli'
import * as repl from '../../repl'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { CommandContext, Context } from '../..'

/** Forget (remove) the host wallet. */
export const action = (ctx: CommandContext) => async (): Promise<void> => {
  const opts = {
    ...cli.yes.read(ctx.cmd)
  }

  const storage = ctx.wallet()
  if (!await storage.check()) {
    console.log('No wallet found.')
    return
  }

  console.log(`Address: ${await storage.address()}`)

  if (!opts.yes) {
    console.log()
    if (await repl.askLetter('Are you sure you want to forget this wallet?', 'yn') === 'n') return
    console.log()
  }

  await storage.delete()
  console.log('Your wallet is forgotten.')
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('forget').description('forget saved wallet').addHelpText('after', help)
  cli.yes.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = `
This command deletes your wallet from disk.
`
