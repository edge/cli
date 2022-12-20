import { Command } from 'commander'
import { readFile as fsReadFile } from 'fs/promises'

export type PrivateKeyOption = {
  privateKey?: string
}

export type PrivateKeyFileOption = {
  privateKeyFile?: string
}

/** Configure `--private-key` and `--private-key-file` options on a command. */
export const configure = (cmd: Command): void => {
  cmd.option('-k, --private-key <string>', 'wallet private key')
  configureFile(cmd)
}

/** Configure `--private-key-file` option on a command. */
export const configureFile = (cmd: Command): void => {
  cmd.option('-K, --private-key-file <path>', 'file containing wallet private key')
}

/**
 * Get private key from command options.
 * Supports both `--passphrase` and `--passphrase-file` options.
 */
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

/** Get private key file option from command options. */
export const readFile = (cmd: Command): PrivateKeyFileOption => {
  const opts = cmd.opts()
  return { privateKeyFile: opts.privateKeyFile }
}
