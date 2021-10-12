import * as xe from '@edge/xe-utils'
import { Network } from '../config'

const xeAmountRegexp = /^(?<amount>\d+) ?(?<unit>m?xe)$/i

export const formatXE = (mxeAmount: number): string => `${mxeAmount / 1e6} XE`

export const parseAmount = (input: string): number => {
  const match = input.match(xeAmountRegexp)
  if (match === null) throw new Error(`invalid amount "${input}"`)
  if (match.groups === undefined) throw new Error(`failed to set match groups from amount "${input}"`)

  const { amount, unit } = match.groups
  if (unit.toLowerCase() === 'xe') return parseFloat(amount) * 1e6
  else return parseFloat(amount)
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
