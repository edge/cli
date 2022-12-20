import { Command } from 'commander'

export type OverwriteOption = {
  overwrite?: boolean
}

/** Configure `--overwrite` option on a command. */
export const configure = (cmd: Command, description = 'overwrite existing wallet if one exists'): void => {
  cmd.option('-f, --overwrite', description)
}

/** Get overwrite option from command options. */
export const read = (cmd: Command): OverwriteOption => {
  const opts = cmd.opts()
  return { overwrite: !!opts.overwrite }
}
