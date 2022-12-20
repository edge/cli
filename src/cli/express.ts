// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'

/** Express release options. */
export type ExpressOption = {
  /** Enable express release, for a fee. */
  express: boolean
}

/** Configure a command with express release options. */
export const configure = (cmd: Command): void => {
  cmd.option('-e, --express', 'express release')
}

/** Read express release options from a command. */
export const read = (cmd: Command): ExpressOption => {
  const opts = cmd.opts()
  return { express: !!opts.express }
}
