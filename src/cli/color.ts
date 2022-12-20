import { Command } from 'commander'

export type ColorOption = {
  noColor: boolean
}

export const configure = (cmd: Command): void => {
  cmd.option('--no-color', 'disable terminal text colors')
}

/**
 * Get global 'no colour' flag from user command.
 * If set, terminal colors are not printed.
 */
export const read = (parent: Command): ColorOption => {
  const opts = parent.opts()
  return { noColor: !!opts.noColor }
}
