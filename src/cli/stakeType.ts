// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import { types } from '../stake'

/** Stake type options. */
export type StakeTypeOption = {
  /** Stake type. */
  stakeType?: string
}

/** Configure a command with stake type options. */
export const configureType = (cmd: Command): void => {
  cmd.option('-t, --stake-type <id>', 'stake type')
}

/** Read stake type options from a command. */
export const readType = (cmd: Command): StakeTypeOption => {
  const opts = cmd.opts()
  if (opts.stakeType !== undefined) {
    if (!types.includes(opts.stakeType)) throw new Error('invalid stake type')
  }
  return { stakeType: opts.stakeType }
}
