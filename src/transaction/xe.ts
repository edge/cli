// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { formatXe } from '@edge/wallet-utils'

/** Regular expression for validating and parsing an input XE amount. */
const xeAmountRegexp = /^(?<amount>\d+) ?(?<unit>m?xe)?$/i

/** Format XE amount for printing. */
export const formatXE = (mxeAmount: number): string => formatXe(mxeAmount / 1e6, true) + ' XE'

/** Parse XE amount from input. */
export const parseAmount = (input: string): number => {
  const match = input.match(xeAmountRegexp)
  if (match === null) throw new Error(`invalid amount "${input}"`)
  if (match.groups === undefined) throw new Error(`failed to set match groups from amount "${input}"`)

  const { amount, unit } = match.groups
  if (unit && unit.toLowerCase() === 'mxe') return parseFloat(amount)
  else return parseFloat(amount) * 1e6
}
