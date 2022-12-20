// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from './cli'
import { Command } from 'commander'
import { commands as aboutCmds } from './about/cli'
import { createLogger } from './log'
import device from './device'
import { command as deviceCmd } from './device/cli'
import indexClient from './api'
import pkg from '../package.json'
import { command as stakeCmd } from './stake/cli'
import { toUpperCaseFirst } from './helpers'
import { command as transactionCmd } from './transaction/cli'
import { command as updateCmd } from './update/cli'
import { wallet } from './wallet'
import { command as walletCmd } from './wallet/cli'
import xeClient from './api/xe'
import { Context, Network } from '.'

/**
 * CLI application entrypoint.
 * See `main-mainnet.ts` and `main-testnet.ts` for usage.
 */
const main = (argv: string[], network: Network): void => {
  const version = `Edge CLI v${pkg.version} (${toUpperCaseFirst(network.name)})`
  const desc = `Edge CLI (${toUpperCaseFirst(network.name)})`

  // configure parent (root) command
  const parent = new Command(network.appName).version(version).description(desc)
  cli.color.configure(parent)
  cli.debug.configure(parent)
  cli.verbose.configure(parent)
  cli.wallet.configure(parent)

  // init context
  const ctx = <Context>{ parent, network }
  ctx.device = (name?: string) => device(ctx, name)
  ctx.indexClient = (name?: string) => indexClient(ctx, name)
  ctx.log = (name?: string) => createLogger(ctx, name)
  ctx.wallet = () => wallet(ctx)
  ctx.xeClient = (name?: string) => xeClient(ctx, name)

  // attach commands
  aboutCmds().forEach(cmd => parent.addCommand(cmd))
  parent.addCommand(deviceCmd(ctx))
  parent.addCommand(stakeCmd(ctx))
  parent.addCommand(transactionCmd(ctx))
  parent.addCommand(updateCmd(ctx, argv))
  parent.addCommand(walletCmd(ctx))

  // run cli
  parent.parse(argv)
}

export default main
