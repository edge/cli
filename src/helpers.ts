// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { platform } from 'os'

/** Format a timestamp to (almost) ISO 8601 standard. */
export const formatTime = (t: number): string => {
  const d = new Date(t)
  const [yyyy, mm, dd, h, m, s] = [
    d.getUTCFullYear(),
    (1 + d.getUTCMonth()).toString().padStart(2, '0'),
    d.getUTCDate().toString().padStart(2, '0'),
    d.getUTCHours().toString().padStart(2, '0'),
    d.getUTCMinutes().toString().padStart(2, '0'),
    d.getUTCSeconds().toString().padStart(2, '0')
  ]
  return `${yyyy}-${mm}-${dd} ${h}:${m}:${s}`
}

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

export const printTable = <T>(headings: string[], prep: (item: T) => string[]) => (data: T[]): string => {
  const rows = [headings, ...data.map(prep)]
  const widths = rows.reduce(
    (ws, row) => ws.map((w, i) => Math.max(w, row[i].length)),
    (new Array(headings.length)).fill(0, 0, headings.length-1)
  )

  return rows.map(row => row
    .map((col, i) => col.padEnd(widths[i], ' '))
    .join('  ')
  ).join('\n')
}

const msDay = 1000 * 60 * 60 * 24

/** Calculate the number of days represented in a duration (rounded up). */
export const toDays = (t: number): number => Math.ceil(t / msDay)

/** Transform the first character of a string to uppercase. */
export const toUpperCaseFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
