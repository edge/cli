// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'

/** Get verbosity options. */
export type VerboseOption = {
  /** Enable verbose logging and printing to REPL, allowing full display of hashes for example. */
  verbose: boolean
}

/** Configure a command with verbosity options. */
export const configure = (cmd: Command): void => {
  cmd.option('-v, --verbose', 'enable detailed output')
}

/** Read verbosity options from a command. */
export const read = (cmd: Command): { verbose: boolean } => {
  const opts = cmd.opts()
  return { verbose: !!opts.verbose }
}
