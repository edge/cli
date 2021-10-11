import * as xe from '@edge/xe-utils'
import { Network } from '../config'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const withNetwork = (network: Network) => {
  const host = network.blockchain.baseURL
  return {
    createTransaction: (signedTx: xe.tx.SignedTx) => xe.tx.createTransactions(host, [signedTx]),
    pendingTransactions: (address: string) => xe.tx.pendingTransactions(host, address),
    walletWithNextNonce: (address: string) => xe.wallet.infoWithNextNonce(host, address)
  }
}
