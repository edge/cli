// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as data from '../data'
import * as repl from '../../repl'
import * as xe from '@edge/xe-utils'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import config from '../../config'
import { errorHandler } from '../../cli'
import { toUpperCaseFirst } from '../../helpers'
import { Context, Network } from '../../main'
import { askToSignTx, handleCreateTxResult } from '../../transaction'
import { canAssign, findOne, precedence as nodeTypePrecedence } from '../../stake'

/**
 * Add a device to the network.
 *
 * This initializes the device as necessary, including creating a device data volume.
 */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...await cli.passphrase.read(ctx.cmd),
    ...cli.docker.readPrefix(ctx.cmd),
    ...cli.stake.read(ctx.cmd),
    ...cli.stake.readType(ctx.cmd),
    ...cli.verbose.read(ctx.parent),
    ...cli.yes.read(ctx.cmd)
  }

  const printAddr = (id: string) => opts.verbose ? id : id.slice(0, config.address.shortLength) + '...'
  const printID = (id: string) => opts.verbose ? id : id.slice(0, config.id.shortLength)

  const device = ctx.device(opts.prefix)
  const xeClient = ctx.xeClient()

  // get device data. if none, initialize device on the fly
  const deviceWallet = await (async () => {
    const volume = await device.volume(true)
    let w: data.Device | undefined = undefined
    try {
      w = await volume.read()
    }
    catch (err) {
      repl.echo('Initializing device...')
      w = { ...xe.wallet.create(), network: ctx.network.name }
      await volume.write(w)
      repl.nl()
    }
    return w as data.Device
  })()

  // get user stakes, check whether device already assigned
  const wallet = ctx.wallet()
  const address = await wallet.address()
  const stakes = await xeClient.stakes(address)
  if (Object.keys(stakes).length === 0) throw new Error('no stakes')

  const assigned = Object.values(stakes).find(s => s.device === deviceWallet.address)
  if (assigned !== undefined) {
    repl.echo(`
    This device is already assigned to stake ${printID(assigned.id)} (${toUpperCaseFirst(assigned.type)}) on Edge ${toUpperCaseFirst(ctx.network.name)}.

    To reassign this device, run '${ctx.network.appName} device remove' first to remove it from the network, then run '${ctx.network.appName} device add' again to add it back.
    `)
    process.exitCode = 1
    return
  }

  // identify stake to assign device to
  const stake = await (async () => {
    if (opts.stake !== undefined) {
      // stake specified by (partial?) ID
      return findOne(stakes, opts.stake)
    }
    else if (opts.stakeType !== undefined) {
      // stake specified by type - use first unassigned (if any)
      const stake = Object.values(stakes).find(s => s.type === opts.stakeType && !s.unlockRequested && !s.device)
      if (stake !== undefined) return stake
      repl.echo(`
      There is no unassigned ${toUpperCaseFirst(opts.stakeType)} stake available to auto-assign.
      `)
    }

    repl.echo(`
    Select a stake to assign this device to:
    `)
    const numberedStakes = Object.values(stakes)
      .filter(canAssign)
      .sort((a, b) => {
        const posDiff = nodeTypePrecedence[a.type] - nodeTypePrecedence[b.type]
        return posDiff !== 0 ? posDiff : a.created - b.created
      })
    numberedStakes.forEach((stake, n) => repl.echo(
      `${n+1}. ${printID(stake.id)} (${toUpperCaseFirst(stake.type)}) ${stake.device ? `(assigned to ${printAddr(stake.device)})` : ''}`
    ))
    repl.nl()
    let sel = 0
    while (sel === 0) {
      const selstr = await repl.ask(`Enter a number: (1-${numberedStakes.length})`)
      const tmpsel = parseInt(selstr)
      if (tmpsel > 0 && tmpsel <= numberedStakes.length) sel = tmpsel
      else repl.echo(`Please enter a number between 1 and ${numberedStakes.length}.`)
    }
    repl.nl()
    return numberedStakes[sel-1]
  })()

  if (!canAssign(stake)) {
    if (stake.released) throw new Error('this stake has been released')
    if (stake.unlockRequested) throw new Error('this stake is unlocked/unlocking and cannot be assigned')
    throw new Error('this stake cannot be assigned for an unknown reason')
  }

  // confirm user intent
  const nodeName = toUpperCaseFirst(stake.type)
  if (!opts.yes) {
    repl.echo(`
    You are adding this device to Edge ${toUpperCaseFirst(ctx.network.name)}.

    This device will be assigned to stake ${printID(stake.id)}, allowing this device to operate a ${nodeName} node.
    `)
    if (stake.device) {
      repl.echo(`
      This stake is already assigned to device ${printAddr(stake.device)} which will be removed from the network if you assign this device in its place.
      `)
    }
    if (await repl.askLetter('Add this device?', 'yn') === 'n') return
    repl.nl()
  }

  // create assignment tx
  await askToSignTx(opts)
  repl.nl()
  const hostWallet = await wallet.read(opts.passphrase as string)

  const onChainWallet = await xeClient.walletWithNextNonce(hostWallet.address)

  const tx = xe.tx.sign({
    timestamp: Date.now(),
    sender: hostWallet.address,
    recipient: hostWallet.address,
    amount: 0,
    data: {
      action: 'assign_device',
      device: deviceWallet.address,
      memo: 'Assign Device',
      signature: xe.wallet.generateSignature(deviceWallet.privateKey, deviceWallet.address),
      stake: stake.hash
    },
    nonce: onChainWallet.nonce
  }, hostWallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(ctx.network, result)) {
    process.exitCode = 1
    return
  }
  repl.nl()

  // next steps advice
  repl.echon(`
  You may run '${ctx.network.appName} tx lsp' to check progress of your pending transaction. When your stake transaction has been processed it will no longer be listed as pending.

  You can then run '${ctx.network.appName} device start' to start a ${nodeName} node on this device.
  `)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('add').description('add this device to the network').addHelpText('after', help(ctx.network))
  cli.docker.configurePrefix(cmd)
  cli.passphrase.configure(cmd)
  cli.stake.configure(cmd)
  cli.stake.configureType(cmd)
  cli.yes.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = (network: Network) => repl.help(`
This command will add this device to the network, allowing it to operate as a node.

Adding a device will:
  - Initialize its identity if needed
  - Assign it to a stake

Stake assignment requires a blockchain transaction. After the transaction has been processed, this device can run a node corresponding to the stake type.

Before you run this command, ensure Docker is running and that you have an unassigned stake to assign this device to.

If you do not already have a stake, you can run '${network.appName} stake create' to get one.
`)
