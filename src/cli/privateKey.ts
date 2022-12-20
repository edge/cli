// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import { readFile as fsReadFile } from 'fs/promises'

/** Private key options. */
export type PrivateKeyOption = {
  /** Private key of the host wallet. */
  privateKey?: string
}

/** Private key file options. */
export type PrivateKeyFileOption = {
  /** Path to a file containing the host wallet's private key. */
  privateKeyFile?: string
}

/** Configure a command with private key options. */
export const configure = (cmd: Command): void => {
  cmd.option('-k, --private-key <string>', 'wallet private key')
  configureFile(cmd)
}

/** Cnfigure a command with private key file options. */
export const configureFile = (cmd: Command): void => {
  cmd.option('-K, --private-key-file <path>', 'file containing wallet private key')
}

/** Read private key options from a command. */
export const read = async (cmd: Command): Promise<PrivateKeyOption> => {
  const opts = cmd.opts()

  if (opts.privateKey?.length) return { privateKey: opts.privateKey }

  // read secure value from file if set
  if (opts.privateKeyFile !== undefined) {
    if (opts.privateKeyFile.length === 0) throw new Error('no path to private key file')
    const data = await fsReadFile(opts.privateKeyFile)
    return { privateKey: data.toString() }
  }

  return {}
}

/** Read private key file options from a command. */
export const readFile = (cmd: Command): PrivateKeyFileOption => {
  const opts = cmd.opts()
  return { privateKeyFile: opts.privateKeyFile }
}
