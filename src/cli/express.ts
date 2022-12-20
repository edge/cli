import { Command } from 'commander'

export type ExpressOption = {
  express: boolean
}

/** Create express release option for CLI. */
export const configure = (cmd: Command): void => {
  cmd.option('-e, --express', 'express release')
}

/** Get express release flag from user command. */
export const read = (cmd: Command): ExpressOption => {
  const opts = cmd.opts()
  return { express: !!opts.express }
}
