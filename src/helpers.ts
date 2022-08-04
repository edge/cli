// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { platform } from 'os'

/**
 * Create a named Error factory.
 * This allows identifiable errors to be thrown without requiring another class.
 */
export const namedError = (name: string) => (msg: string): Error => {
  const err = new Error(msg)
  err.name = name
  return err
}

/** Normalise the platform string provided by Node. */
export const normalizedPlatform = (): string => {
  const p = platform()
  if (p === 'darwin') return 'macos'
  if (p === 'win32') return 'windows'
  return p
}

/**
 * Print object data in a simple, aligned list layout.
 *
 * For example, the following object:
 *
 * ```json
 * {
 *   "Name": "Edge",
 *   "Version: 1.0.0"
 * }
 * ```
 *
 * Would be formatted like so:
 *
 * ```
 * Name:    Edge
 * Version: 1.0.0
 * ```
 */
export const printData = (data: Record<string, string>, sep = ':'): string => {
  const klen = sep.length + Object.keys(data).reduce((n, k) => Math.max(n, k.length), 0)
  return Object.keys(data).map(k => [k, data[k]]).map(([k, v]) => {
    const kprint = `${k}${sep}`.padEnd(klen, ' ')
    return `${kprint} ${v}`
  }).join('\n')
}

const msDay = 1000 * 60 * 60 * 24

/** Calculate the number of days represented in a duration (rounded up). */
export const toDays = (t: number): number => Math.ceil(t / msDay)

/** Transform the first character of a string to uppercase. */
export const toUpperCaseFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
