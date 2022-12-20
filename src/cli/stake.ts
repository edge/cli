// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'

/** Stake options. */
export type StakeOption = {
  /** Stake ID. */
  stake?: string
}

/** Configure a command with stake options. */
export const configure = (cmd: Command, description = 'stake ID'): void => {
  cmd.option('-s, --stake <id>', description)
}

/** Read stake options from a command. */
export const read = (cmd: Command): StakeOption => {
  const opts = cmd.opts()
  return { stake: opts.stake }
}
