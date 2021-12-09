// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as xe from '@edge/xe-utils'
import { Context } from '../main'
import { formatXe } from '@edge/wallet-utils'

const xeAmountRegexp = /^(?<amount>\d+) ?(?<unit>m?xe)?$/i

export const formatXE = (mxeAmount: number): string => formatXe(mxeAmount / 1e6, true) + ' XE'

export const parseAmount = (input: string): number => {
  const match = input.match(xeAmountRegexp)
  if (match === null) throw new Error(`invalid amount "${input}"`)
  if (match.groups === undefined) throw new Error(`failed to set match groups from amount "${input}"`)

  const { amount, unit } = match.groups
  if (unit && unit.toLowerCase() === 'mxe') return parseFloat(amount)
  else return parseFloat(amount) * 1e6
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const withContext = (ctx: Context) => {
  const host = ctx.network.blockchain.baseURL
  const log = ctx.logger('xe').extend({ host })

  const createTransaction = async (signedTx: xe.tx.SignedTx) => {
    log.info('Creating transaction', { signedTx })
    const data = await xe.tx.createTransactions(host, [signedTx])
    log.debug('Response', { data })
    return data
  }

  const pendingTransactions = async (address: string) => {
    log.info('Getting pending transactions', { address })
    const data = await xe.tx.pendingTransactions(host, address)
    log.debug('Response', { data })
    return data
  }

  const walletWithNextNonce = async (address: string) => {
    log.info('Getting wallet with next nonce', { address })
    const data = await xe.wallet.infoWithNextNonce(host, address)
    log.debug('Response', { data })
    return data
  }

  return { createTransaction, pendingTransactions, walletWithNextNonce }
}
