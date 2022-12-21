// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as repl from '../../repl'
import { Command } from 'commander'
import { Context } from '../../main'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'

/** Display host wallet. */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...await cli.passphrase.read(ctx.cmd)
  }

  const wallet = ctx.wallet()
  repl.echo(`Address: ${await wallet.address()}`)

  if (opts.passphrase) {
    try {
      const hostWallet = await wallet.read(opts.passphrase)
      repl.echo(`Private key: ${hostWallet.privateKey}`)
    }
    catch (err) {
      repl.echo(`Cannot display private key: ${(err as Error).message}`)
    }
  }
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('info').description('display saved wallet info').addHelpText('after', help)
  cli.passphrase.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = repl.help(`
This command displays information about your wallet.

If a passphrase is provided, this command will also decrypt and display your private key.
`)
