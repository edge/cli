import { Command } from 'commander'

export type YesOption = {
  yes: boolean
}

export const configure = (cmd: Command, description = 'do not ask for confirmation'): void => {
  cmd.option('-y, --yes', description)
}

/**
 * Get 'yes' flag from user command.
 * If true, this should skip all interactive confirmations.
 */
export const read = (cmd: Command): YesOption => {
  const opts = cmd.opts()
  return { yes: !!opts.yes }
}
