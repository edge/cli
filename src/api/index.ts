// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as index from '@edge/index-utils'
import { Context } from '../main'
import { SuperAgentRequest } from 'superagent'
import config from '../config'

/**
 * Index API client wrapper.
 * Provides additional logging around standard library requests.
 */
export type IndexClient = ReturnType<typeof client>

/**
 * Create an Index API client.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const client = (ctx: Context) => {
  const { host } = ctx.network.index
  const log = ctx.log('index')

  const cb = (r: SuperAgentRequest) => r.timeout(config.index.defaultTimeout)

  const transaction = async (hash: string) => {
    log.debug('transaction', { host, hash })
    const data = await index.tx.transaction(host, hash, cb)
    log.debug('transaction response', { data })
    return data
  }

  const transactions = async (address: string, params?: index.tx.TxsParams) => {
    log.debug('transactions', { host, address, params })
    const data = await index.tx.transactions(host, address, params, cb)
    log.debug('transactions response', { data })
    return data
  }

  return {
    transaction,
    transactions
  }
}

export default client
