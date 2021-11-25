// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { platform } from 'os'

export const namedError = (name: string) => (msg: string): Error => {
  const err = new Error(msg)
  err.name = name
  return err
}

export const normalizedPlatform = (): string => {
  const p = platform()
  if (p === 'darwin') return 'macos'
  if (p === 'win32') return 'windows'
  return p
}

export const printData = (data: Record<string, string>, sep = ':'): string => {
  const klen = sep.length + Object.keys(data).reduce((n, k) => Math.max(n, k.length), 0)
  return Object.keys(data).map(k => [k, data[k]]).map(([k, v]) => {
    const kprint = `${k}${sep}`.padEnd(klen, ' ')
    return `${kprint} ${v}`
  }).join('\n')
}

/**
 * This convenience function returns a function that truncates a given string to a specific length if a `short` flag
 * is true. This is useful for dense formatting of long hashes and digests, where an option may be provided to display
 * them in full.
 */
export const printTrunc = (short: boolean, n: number) => (d: string): string => short ? d.slice(0, n) : d

const msDay = 1000 * 60 * 60 * 24
export const toDays = (t: number): number => Math.ceil(t / msDay)

export const toUpperCaseFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
