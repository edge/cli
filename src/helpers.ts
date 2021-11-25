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

export const shortDigest = (d: string): string => d.slice(0, 8)

const msDay = 1000 * 60 * 60 * 24
export const toDays = (t: number): number => Math.ceil(t / msDay)

export const toUpperCaseFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
