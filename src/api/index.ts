import * as index from '@edge/index-utils'
import { Context } from '..'
import { SuperAgentRequest } from 'superagent'
import config from '../config'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const client = ({ logger, network }: Pick<Context, 'logger' | 'network'>, name = 'index') => {
  const host = network.index.baseURL
  const log = logger(name)

  const cb = (r: SuperAgentRequest) => r.timeout(config.index.defaultTimeout)

  const stakes = async (address?: string, params?: index.stake.StakesParams) => {
    log.debug('stakes', { host, address, params })
    const data = await index.stake.stakes(host, address, params, cb)
    log.debug('stakes response', { data })
    return data
  }

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
    stakes,
    transaction,
    transactions
  }
}

export default client
