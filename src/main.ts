// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as deviceCLI from './device/cli'
import * as stakeCLI from './stake/cli'
import * as transactionCLI from './transaction/cli'
import * as updateCLI from './update/cli'
import * as walletCLI from './wallet/cli'
import { Command } from 'commander'
import { create as createCLI } from './edge/cli'

export type CommandContext = Context & {
  cmd: Command
}

export type Context = {
  parent: Command
  network: Network
}

export type Network = {
  appName: string
  name: string
  blockchain: {
    baseURL: string
  }
  explorer: {
    baseURL: string
  }
  files: {
    latestBuildURL: (os: string, arch: string, ext: string) => string
    latestChecksumURL: (os: string, arch: string) => string
    latestVersionURL: (os: string, arch: string) => string
  }
  flags: Record<string, boolean>
  index: {
    baseURL: string
  }
  registry: {
    imageName: (app: string) => string
  }
  wallet: {
    defaultFile: string
  }
}

const main = (argv: string[], network: Network): void => {
  const cli = createCLI(network)
  const ctx = { parent: cli, network }

  if (network.flags.onboarding) cli.addCommand(deviceCLI.withContext(ctx))

  cli.addCommand(stakeCLI.withContext(ctx))
  cli.addCommand(transactionCLI.withContext(ctx))
  cli.addCommand(updateCLI.withContext(ctx, argv))

  const [walletCmd, walletOption] = walletCLI.withContext(ctx)
  cli.addCommand(walletCmd).addOption(walletOption)

  cli.parse(argv)
}

export default main
