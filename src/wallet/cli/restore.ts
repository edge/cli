// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as repl from '../../repl'
import * as xe from '@edge/xe-utils'
import { Command } from 'commander'
import { Context } from '../../main'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'

/** Restore a host wallet using a private key. */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.overwrite.read(ctx.cmd),
    ...await cli.passphrase.read(ctx.cmd),
    ...await cli.privateKey.read(ctx.cmd)
  }

  const wallet = ctx.wallet()

  if (await wallet.check() && !opts.overwrite) {
    if (await repl.askLetter('A wallet already exists. Overwrite?', 'yn') === 'n') return
    console.log()
  }

  if (!opts.privateKey) {
    const privateKey = await repl.askSecure('Please enter a private key: ')
    if (privateKey.length === 0) throw new Error('private key required')
    if (!xe.wallet.validatePrivateKey(privateKey)) throw new Error('invalid private key')
    opts.privateKey = privateKey
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

  const hostWallet = xe.wallet.recover(opts.privateKey || '')
  await wallet.write(hostWallet, opts.passphrase)
  console.log(`Wallet ${hostWallet.address} restored.`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('restore').description('restore a wallet').addHelpText('after', help)
  cli.overwrite.configure(cmd)
  cli.passphrase.configure(cmd)
  cli.privateKey.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

/* eslint-disable max-len */
const help = `
'This command will restore an existing wallet using a private key you already have.

You will be asked to provide a passphrase to encrypt the wallet locally. The passphrase is also required later to decrypt the wallet for certain actions, such as signing transactions.
`
/* eslint-enable max-len */
