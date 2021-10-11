import * as index from '@edge/index-utils'
import { Network } from '../config'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const withNetwork = (network: Network) => {
  const host = network.index.baseURL
  return {
    transactions: (address: string, params?: index.TxsParams) => index.transactions(host, address, params)
  }
}
