// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import { Network } from '../main'

/** Wallet options. */
export type WalletOption = {
  /** Path to host wallet file. */
  wallet: string
}

/** Configure a command with wallet options. */
export const configure = (cmd: Command): void => {
  cmd.option('-w, --wallet <file>', 'wallet file path')
}

/** Read wallet options from a command. */
export const read = (parent: Command, network: Network): WalletOption => {
  const { wallet } = parent.opts<Partial<WalletOption>>()
  return { wallet: wallet || network.wallet.defaultFile }
}
