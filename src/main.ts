// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from './cli'
import * as sg from '@edge/stargate-utils'
import { Command } from 'commander'
import { Log } from '@edge/log'
import { commands as aboutCmds } from './about/cli'
import { createLogger } from './log'
import { command as deviceCmd } from './device/cli'
import pkg from '../package.json'
import { command as stakeCmd } from './stake/cli'
import { toUpperCaseFirst } from './helpers'
import { command as transactionCmd } from './transaction/cli'
import { command as updateCmd } from './update/cli'
import { command as walletCmd } from './wallet/cli'
import { HostWallet, wallet } from './wallet'
import device, { Device } from './device'
import indexClient, { IndexClient } from './api'
import xeClient, { XEClient } from './api/xe'

/**
 * Global context.
 * This is passed around code to provide access to common objects, getters (providers), CLI options, etc.
 */
export type Context = {
  cmd: Command
  /**
   * Provider for a device object.
   *
   * `prefix` determines which device/node should be accessed; if undefined, it will default to an un-prefixed
   * (single) device/node.
   * `name` is used in logging.
   */
  device: (prefix: string | undefined, name?: string) => Device
  indexClient: () => IndexClient
  log: (name?: string) => Log
  parent: Command
  network: Network
  wallet: () => HostWallet
  xeClient: () => XEClient
}

/**
 * Network configuration.
 * Defines standard structure for per-network config.
 */
export type Network = {
  appName: string
  name: string
  blockchain: {
    host: string
  }
  explorer: {
    host: string
  }
  files: {
    latestBuildURL: (os: string, arch: string, ext: string) => string
    latestChecksumURL: (os: string, arch: string) => string
    latestVersionURL: (os: string, arch: string) => string
  }
  flags: Record<string, boolean>
  index: {
    host: string
  }
  registry: {
    imageName: (app: string, arch: string) => string
  }
  stargate: {
    host: sg.Host
  }
  wallet: {
    defaultFile: string
  }
}

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
  ctx.indexClient = () => indexClient(ctx)
  ctx.log = (name?: string) => createLogger(ctx, name)
  ctx.wallet = () => wallet(ctx)
  ctx.xeClient = () => xeClient(ctx)

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
