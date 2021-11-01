// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as deviceCLI from './device/cli'
import * as stakeCLI from './stake/cli'
import * as transactionCLI from './transaction/cli'
import * as walletCLI from './wallet/cli'
import { create as createCLI } from './edge/cli'

export type Network = {
  name: string
  blockchain: {
    baseURL: string
  }
  explorer: {
    baseURL: string
  }
  index: {
    baseURL: string
  }
}

const main = (argv: string[], network: Network): void => {
  const cli = createCLI(network)

  deviceCLI.withProgram(cli)
  stakeCLI.withProgram(cli, network)
  transactionCLI.withProgram(cli, network)
  walletCLI.withProgram(cli)

  cli.parse(argv)
}

export default main
