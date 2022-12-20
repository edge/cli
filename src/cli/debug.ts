import { Command } from 'commander'

export type DebugOption = {
  debug: boolean
}

export const configure = (cmd: Command): void => {
  cmd.option('--debug', 'enable detailed error and debug messages')
}

/**
 * Get global debug flag from user command.
 * If set, debug messages are printed.
 */
export const read = (parent: Command): DebugOption => {
  const opts = parent.opts()
  return { debug: !!opts.debug }
}
