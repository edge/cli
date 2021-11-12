// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as index from '@edge/index-utils'
import { Network } from '../main'
import { askSecure } from '../input'

export const askToSignTx = async (opts: { passphrase?: string }): Promise<void> => {
  if (!opts.passphrase) {
    console.log('This transaction must be signed with your private key.')
    console.log(
      'Please enter your passphrase to decrypt your private key, sign your transaction,',
      'and submit it to the blockchain.'
    )
    // console.log('For more information, see https://wiki.edge.network/TODO')
    console.log()
    const passphrase = await askSecure('Passphrase: ')
    if (passphrase.length === 0) throw new Error('passphrase required')
    opts.passphrase = passphrase
    console.log()
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const withNetwork = (network: Network) => {
  const host = network.index.baseURL
  return {
    transactions: (address: string, params?: index.TxsParams) => index.transactions(host, address, params)
  }
}
