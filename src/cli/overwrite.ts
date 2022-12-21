// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'

/**
 * Overwrite options.
 * Typically pertains to the host wallet but may have other applications.
 */
export type OverwriteOption = {
  /** Overwrite existing data. */
  overwrite?: boolean
}

/** Configure a command with overwrite options. */
export const configure = (cmd: Command, description = 'overwrite existing wallet if one exists'): void => {
  cmd.option('-f, --overwrite', description)
}

/** Read overwrite options from a command. */
export const read = (cmd: Command): OverwriteOption => {
  const opts = cmd.opts()
  return { overwrite: !!opts.overwrite }
}
