// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'

/** Debugging options. */
export type DebugOption = {
  /** Enable debug logs and some debugging behaviours. */
  debug: boolean
}

/** Configure a command with debug options. */
export const configure = (cmd: Command): void => {
  cmd.option('--debug', 'enable detailed error and debug messages')
}

/** Read debug options from a command. */
export const read = (parent: Command): DebugOption => {
  const opts = parent.opts()
  return { debug: !!opts.debug }
}
