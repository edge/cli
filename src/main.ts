// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as deviceCLI from './device/cli'
import * as stakeCLI from './stake/cli'
import * as transactionCLI from './transaction/cli'
import * as walletCLI from './wallet/cli'
import { create as createCLI } from './edge/cli'

const main = (argv: string[]): void => {
  const cli = createCLI()

  deviceCLI.withProgram(cli)
  stakeCLI.withProgram(cli)
  transactionCLI.withProgram(cli)
  walletCLI.withProgram(cli)

  cli.parse(argv)
}

main(process.argv)
