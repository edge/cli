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

/** Configure a command with stake options. */
export const configure = (cmd: Command): void => {
  cmd.option('-t, --stake-type <id>', 'stake type')
}

/** Read stake options from a command. */
export const read = (cmd: Command): StakeTypeOption => {
  const opts = cmd.opts()
  if (opts.stakeType !== undefined) {
    if (!types.includes(opts.stakeType)) throw new Error('invalid stake type')
  }
  return { stakeType: opts.stakeType }
}
