// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'

/** Color options. */
export type ColorOption = {
  /** Disable ANSI terminal colours. */
  noColor: boolean
}

/** Configure a command with color options. */
export const configure = (cmd: Command): void => {
  cmd.option('--no-color', 'disable terminal text colors')
}

/** Read color options from a command. */
export const read = (parent: Command): ColorOption => {
  const opts = parent.opts()
  return { noColor: !!opts.noColor }
}
