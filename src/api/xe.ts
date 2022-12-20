// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as xe from '@edge/xe-utils'
import { Context } from '..'
import { SuperAgentRequest } from 'superagent'
import config from '../config'

export type XEClient = ReturnType<typeof client>

/**
 * Create an XE blockchain API client.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const client = (ctx: Context, name = 'xe') => {
  const host = ctx.network.blockchain.baseURL
  const log = ctx.log(name)

  const cb = (r: SuperAgentRequest) => r.timeout(config.blockchain.defaultTimeout)

  const createTransaction = async (signedTx: xe.tx.SignedTx) => {
    log.debug('createTransaction', { host, signedTx })
    const data = await xe.tx.createTransactions(host, [signedTx], cb)
    log.debug('createTransaction response', data)
    return data
  }

  const pendingTransactions = async (address: string) => {
    log.debug('pendingTransactions', { host, address })
    const data = await xe.tx.pendingTransactions(host, address, cb)
    log.debug('pendingTransactions response', { data })
    return data
  }

  const stakes = async (address: string) => {
    log.debug('stakes', { host, address })
    const data = await xe.stake.stakes(host, address, cb)
    log.debug('stakes response', { data })
    return data
  }

  const wallet = async (address: string) => {
    log.debug('wallet', { host, address })
    const data = await xe.wallet.info(host, address, cb)
    log.debug('wallet response', { data })
    return data
  }

  const walletWithNextNonce = async (address: string) => {
    log.debug('walletWithNextNonce', { host, address })
    const data = await xe.wallet.infoWithNextNonce(host, address, cb)
    log.debug('walletWithNextNonce response', { data })
    return data
  }

  const vars = async () => {
    log.debug('vars', { host })
    const data = await xe.vars(host, cb)
    log.debug('vars response', { data })
    return data
  }

  return {
    createTransaction,
    pendingTransactions,
    stakes,
    wallet,
    walletWithNextNonce,
    vars
  }
}

export default client
