import { Command } from 'commander'

export type MemoOption = {
  memo?: string
}

/** Create transaction memo option for CLI. */
export const configure = (cmd: Command, description = 'attach a memo to the transaction'): void => {
  cmd.option('-m, --memo <text>', description)
}

/** Get transaction memo from user command. */
export const read = (cmd: Command): MemoOption => {
  const opts = cmd.opts()
  return { memo: opts.memo }
}
