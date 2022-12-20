import * as cli from '../../cli'
import * as repl from '../../repl'
import * as xe from '@edge/xe-utils'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { writeFile } from 'fs/promises'
import { CommandContext, Context } from '../..'

/** Create a new host wallet. */
export const action = ({ cmd, logger, wallet }: CommandContext) => async (): Promise<void> => {
  const log = logger()

  const opts = {
    ...cli.overwrite.read(cmd),
    ...await cli.passphrase.read(cmd),
    ...cli.privateKey.readFile(cmd)
  }
  log.debug('options', opts)

  const storage = wallet()

  if (await storage.check() && !opts.overwrite) {
    if (await repl.askLetter('A wallet already exists. Overwrite?', 'yn') === 'n') return
    console.log()
  }

  if (!opts.passphrase) {
    console.log('To ensure your wallet is secure it will be encrypted locally using a passphrase.')
    // console.log('For more information, see https://wiki.edge.network/TODO')
    console.log()
    const passphrase = await repl.askSecure('Please enter a passphrase: ')
    if (passphrase.length === 0) throw new Error('passphrase required')
    const confirmKey = await repl.askSecure('Please confirm passphrase: ')
    if (confirmKey !== passphrase) throw new Error('passphrases do not match')
    opts.passphrase = passphrase
    console.log()
  }

  const userWallet = xe.wallet.create()
  await storage.write(userWallet, opts.passphrase)
  console.log(`Wallet ${userWallet.address} created.`)
  console.log()

  const nextStep = opts.privateKeyFile
    ? 'e'
    : await repl.askLetter('Would you like to (v)iew or (e)xport your private key?', 'ven')

  if (nextStep === 'v') {
    console.log(`Private key: ${userWallet.privateKey}`)
    console.log()
    console.log('Keep your private key safe!')
    return
  }
  else if (nextStep === 'n') return

  let pkFile = opts.privateKeyFile || ''
  if (pkFile.length === 0) {
    while (pkFile.length === 0) {
      const input = await repl.ask('Enter filename to export private key to: ')
      if (input.length) pkFile = input
    }
    console.log()
  }
  try {
    log.debug('writing file', { file: pkFile })
    await writeFile(pkFile, userWallet.privateKey)
    log.debug('wrote file', { file: pkFile })
    console.log(`Private key saved to ${pkFile}.`)
  }
  catch (err) {
    console.log('Failed to write to private key file. Displaying it instead...')
    console.log()
    console.log(`Private key: ${userWallet.privateKey}`)
    throw err
  }
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('create').description('create a new wallet').addHelpText('after', help)
  cli.overwrite.configure(cmd)
  cli.passphrase.configure(cmd)
  cli.privateKey.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

/* eslint-disable max-len */
const help = `
This command will create a new wallet.

You will be asked to provide a passphrase to encrypt the wallet locally.

The passphrase is also required later to decrypt the wallet for certain actions, such as signing transactions.

You will also be given the option to view or export the private key for the new wallet. This should be copied to a secure location and kept secret.
`
/* eslint-enable max-len */
