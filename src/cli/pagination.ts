import { Command } from 'commander'

export type PaginationOptions = {
  limit: number
  page: number
}

/** Configure `--limit` and `--page` options on a command. */
export const configure = (cmd: Command, limitDesc = 'items per page', pageDesc = 'page number'): void => {
  cmd.option('-l, --limit <n>', limitDesc, '10')
  cmd.option('-p, --page <n>', pageDesc, '1')
}

/** Get pagination parameters from command options. */
export const read = (cmd: Command): PaginationOptions => {
  const { limit, page } = cmd.opts<{ limit: string, page: string }>()
  return {
    limit: parseInt(limit),
    page: parseInt(page)
  }
}
