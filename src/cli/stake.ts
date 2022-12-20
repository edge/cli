import { Command } from 'commander'

export type StakeOption = {
  stake?: string
}

/** Create stake option for CLI. */
export const configure = (cmd: Command, description = 'stake ID'): void => {
  cmd.option('-s, --stake <id>', description)
}

/**
 * Get stake hash from user command.
 */
export const read = (cmd: Command): StakeOption => {
  const opts = cmd.opts()
  return { stake: opts.stake }
}
