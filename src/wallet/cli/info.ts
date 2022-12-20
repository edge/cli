import * as cli from '../../cli'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { CommandContext, Context } from '../..'

/** Display host wallet. */
export const action = ({ wallet, ...ctx }: CommandContext) => async (): Promise<void> => {
  const storage = wallet()
  console.log(`Address: ${await storage.address()}`)

  const { passphrase } = await cli.passphrase.read(ctx.cmd)
  if (passphrase) {
    try {
      const userWallet = await storage.read(passphrase)
      console.log(`Private key: ${userWallet.privateKey}`)
    }
    catch (err) {
      console.log(`Cannot display private key: ${(err as Error).message}`)
    }
  }
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('info').description('display saved wallet info').addHelpText('after', help)
  cli.passphrase.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = `
This command displays information about your wallet.

If a passphrase is provided, this command will also decrypt and display your private key.
`
