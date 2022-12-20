// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'

/** Affirmation options. */
export type YesOption = {
  /** Skip yes/no prompts with preemptively affirmative responses. */
  yes: boolean
}

/** Configure a command with affirmation options. */
export const configure = (cmd: Command, description = 'do not ask for confirmation'): void => {
  cmd.option('-y, --yes', description)
}

/** Read affirmation options from a command. */
export const read = (cmd: Command): YesOption => {
  const opts = cmd.opts()
  return { yes: !!opts.yes }
}
