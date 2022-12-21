// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import { readFile } from 'fs/promises'

/** Passphrase options. */
export type PassphraseOption = {
  /** Passphrase to unlock the host wallet. */
  passphrase?: string
}

/** Configure a command with passphrase options. */
export const configure = (cmd: Command): void => {
  cmd.option('-p, --passphrase <string>', 'wallet passphrase')
  cmd.option('-P, --passphrase-file <path>', 'file containing wallet passphrase')
}

/** Read passphrase options from a command. */
export const read = async (cmd: Command): Promise<PassphraseOption> => {
  const opts = cmd.opts()
  if (opts.passphrase?.length) return { passphrase: opts.passphrase }

  // read secure value from file if set
  if (opts.passphraseFile !== undefined) {
    if (opts.passphraseFile.length === 0) throw new Error('no path to passphrase file')
    const data = await readFile(opts.passphraseFile)
    return { passphrase: data.toString() }
  }

  return {}
}
