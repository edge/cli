// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import { statuses } from '../stake'

/** Stake status options. */
export type StakeStatusOption = {
  /** Stake status. */
  stakeStatus?: string
}

/** Configure a command with stake status options. */
export const configure = (cmd: Command): void => {
  cmd.option('-s, --stake-status <status>', 'stake status')
}

/** Read stake status options from a command. */
export const read = (cmd: Command): StakeStatusOption => {
  const opts = cmd.opts()
  if (opts.stakeStatus !== undefined) {
    if (!statuses.includes(opts.stakeStatus)) throw new Error('invalid stake status')
  }
  return { stakeStatus: opts.stakeStatus }
}
