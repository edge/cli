// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as repl from '../../repl'
import { Command } from 'commander'
import { Context } from '../..'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'

/** Forget (remove) the host wallet. */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.yes.read(ctx.cmd)
  }

  const wallet = ctx.wallet()
  if (!await wallet.check()) {
    console.log('No wallet found.')
    return
  }

  console.log(`Address: ${await wallet.address()}`)

  if (!opts.yes) {
    console.log()
    if (await repl.askLetter('Are you sure you want to forget this wallet?', 'yn') === 'n') return
    console.log()
  }

  await wallet.delete()
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
