// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'

/** Transaction memo options. */
export type MemoOption = {
  /** Transaction memo. */
  memo?: string
}

/** Configure a command with transaction memo options. */
export const configure = (cmd: Command): void => {
  cmd.option('-m, --memo <text>', 'attach a memo to the transaction')
}

/** Read transaction memo options from a command. */
export const read = (cmd: Command): MemoOption => {
  const opts = cmd.opts()
  return { memo: opts.memo }
}
