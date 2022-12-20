// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'

/** Pagination options. */
export type PaginationOptions = {
  /** Number of results per page. */
  limit: number
  /** Page number. */
  page: number
}

/** Configure a command with pagination options. */
export const configure = (cmd: Command, limitDesc = 'items per page', pageDesc = 'page number'): void => {
  cmd.option('-l, --limit <n>', limitDesc, '10')
  cmd.option('-p, --page <n>', pageDesc, '1')
}

/** Read pagination options from a command. */
export const read = (cmd: Command): PaginationOptions => {
  const opts = cmd.opts()
  return {
    limit: parseInt(opts.limit),
    page: parseInt(opts.page)
  }
}
