// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as xe from '@edge/xe-utils'
import { Network } from '../main'

const xeAmountRegexp = /^(?<amount>\d+) ?(?<unit>m?xe)?$/i

export const formatXE = (mxeAmount: number): string => {
  const xeAmount = mxeAmount / 1e6
  if (xeAmount < 1000) return `${xeAmount} XE`
  const withSep = xeAmount.toString().split('').reverse().reduce((s, n, i) => {
    if (i % 3 === 0 && i > 0) return `${n},${s}`
    return `${n}${s}`
  }, '')
  return `${withSep} XE`
}

export const parseAmount = (input: string): number => {
  const match = input.match(xeAmountRegexp)
  if (match === null) throw new Error(`invalid amount "${input}"`)
  if (match.groups === undefined) throw new Error(`failed to set match groups from amount "${input}"`)

  const { amount, unit } = match.groups
  if (unit && unit.toLowerCase() === 'mxe') return parseFloat(amount)
  else return parseFloat(amount) * 1e6
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const withNetwork = (network: Network) => {
  const host = network.blockchain.baseURL
  return {
    createTransaction: (signedTx: xe.tx.SignedTx) => xe.tx.createTransactions(host, [signedTx]),
    pendingTransactions: (address: string) => xe.tx.pendingTransactions(host, address),
    walletWithNextNonce: (address: string) => xe.wallet.infoWithNextNonce(host, address)
  }
}
