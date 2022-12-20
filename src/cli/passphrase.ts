import { Command } from 'commander'
import { readFile } from 'fs/promises'

export type PassphraseOption = {
  passphrase?: string
}

/** Configure `--passphrase` and `--passphrase-file` options on a command. */
export const configure = (cmd: Command): void => {
  cmd.option('-p, --passphrase <string>', 'wallet passphrase')
  cmd.option('-P, --passphrase-file <path>', 'file containing wallet passphrase')
}

/**
 * Get passphrase from command options.
 * Supports both `--passphrase` and `--passphrase-file` options.
 */
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
