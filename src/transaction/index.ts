// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as repl from '../repl'
import { Network } from '../main'
import { tx as xeTx } from '@edge/xe-utils'

/**
 * Transaction signing request handler.
 */
export const askToSignTx = async (opts: { passphrase?: string }): Promise<void> => {
  if (!opts.passphrase) {
    console.log('This transaction must be signed with your private key.')
    console.log(
      'Please enter your passphrase to decrypt your private key, sign your transaction,',
      'and submit it to the blockchain.'
    )
    // console.log('For more information, see https://wiki.edge.network/TODO')
    console.log()
    const passphrase = await repl.askSecure('Passphrase: ')
    if (passphrase.length === 0) throw new Error('passphrase required')
    opts.passphrase = passphrase
    console.log()
  }
}

/**
 * Transaction creation handler.
 */
export const handleCreateTxResult = (network: Network, result: xeTx.CreateResponse): boolean => {
  if (result.metadata.accepted !== 1) {
    const reason = result.results.find(r => r)?.reason || 'unknown reason'
    console.log(`There was a problem creating your transaction: ${reason}`)
    return false
  }
  else {
    console.log('Your transaction has been submitted and will appear in the explorer shortly.')
    console.log()
    console.log(`${network.explorer.host}/transaction/${result.results[0].hash}`)
    return true
  }
}
