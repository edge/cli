// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as repl from '../../repl'
import * as xeUtils from '@edge/xe-utils'
import { Command } from 'commander'
import { Context } from '../../main'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { findOne } from '..'
import { formatXE } from '../../transaction/xe'
import { xeVars } from '.'
import { askToSignTx, handleCreateTxResult } from '../../transaction'
import { formatTime, toUpperCaseFirst } from '../../helpers'

/**
 * Release a stake.
 *
 * The stake must first be unlocked.
 */
export const action = (ctx: Context) => async (id: string): Promise<void> => {
  const opts = {
    ...cli.debug.read(ctx.parent),
    ...await cli.passphrase.read(ctx.cmd),
    ...cli.express.read(ctx.cmd),
    ...cli.yes.read(ctx.cmd)
  }

  const wallet = ctx.wallet()
  const stakes = await ctx.xeClient().stakes(await wallet.address())
  const stake = findOne(stakes, id)

  if (stake.released !== undefined) {
    console.log('This stake has already been released.')
    return
  }

  if (stake.unlockRequested === undefined) {
    console.log('This stake must be unlocked before it can be released.')
    return
  }

  const xeClient = ctx.xeClient()

  const unlockAt = stake.unlockRequested + stake.unlockPeriod
  const needUnlock = unlockAt > Date.now()
  if (needUnlock && !opts.express) {
    const { stake_express_release_fee } = await xeVars(xeClient, opts.debug)
    const releaseFee = stake_express_release_fee * stake.amount
    const releasePc = stake_express_release_fee * 100
    console.log(`This stake has not unlocked yet. It unlocks at ${formatTime(unlockAt)}.`)
    console.log(`You can release it instantly for a ${releasePc}% express release fee (${formatXE(releaseFee)}).`)
    console.log()
    console.log('To do so, execute this command again with the --express flag.')
    return
  }

  if (!opts.yes) {
    // eslint-disable-next-line max-len
    console.log(`You are releasing a ${toUpperCaseFirst(stake.type)} stake.`)
    if (needUnlock) {
      const { stake_express_release_fee } = await xeVars(xeClient, opts.debug)
      const releaseFee = stake_express_release_fee * stake.amount
      const releasePc = stake_express_release_fee * 100
      console.log([
        `${formatXE(stake.amount - releaseFee)} will be returned to your available balance after paying `,
        `a ${releasePc}% express release fee (${formatXE(releaseFee)}).`
      ].join(''))
    }
    else console.log(`${formatXE(stake.amount)} will be returned to your available balance.`)
    console.log()
    if (await repl.askLetter('Proceed with release?', 'yn') === 'n') return
    console.log()
  }

  await askToSignTx(opts)
  const hostWallet = await wallet.read(opts.passphrase as string)

  const onChainWallet = await xeClient.walletWithNextNonce(hostWallet.address)

  const data: xeUtils.tx.TxData = {
    action: 'release_stake',
    memo: 'Release Stake',
    stake: stake.hash
  }
  if (needUnlock) data.express = true
  const tx = xeUtils.tx.sign({
    timestamp: Date.now(),
    sender: hostWallet.address,
    recipient: hostWallet.address,
    amount: 0,
    data,
    nonce: onChainWallet.nonce
  }, hostWallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(ctx.network, result)) process.exitCode = 1
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('release')
    .argument('<id>', 'stake ID')
    .description('release a stake')
    .addHelpText('after', help)
  cli.express.configure(cmd)
  cli.passphrase.configure(cmd)
  cli.yes.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

/* eslint-disable max-len */
const help = `
Release a stake.

The --express option instructs the blockchain to take a portion of your stake in return for an immediate release of funds, rather than waiting for the unlock period to conclude.
`
/* eslint-enable max-len */
