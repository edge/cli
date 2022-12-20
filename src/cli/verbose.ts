import { Command } from 'commander'

export type VerboseOption = {
  verbose: boolean
}

export const configure = (cmd: Command): void => {
  cmd.option('-v, --verbose', 'enable detailed output')
}

/**
 * Get global verbose output flag from user command.
 * If set, more detail is provided in printed output e.g. full hashes.
 */
export const read = (cmd: Command): { verbose: boolean } => {
  const opts = cmd.opts()
  return { verbose: !!opts.verbose }
}
