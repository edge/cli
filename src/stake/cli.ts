// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as walletCLI from '../wallet/cli'
import * as xe from '@edge/xe-utils'
import { Command } from 'commander'
import { Network } from '../main'
import { ask } from '../input'
import { askToSignTx } from '../transaction'
import { errorHandler } from '../edge/cli'
import { decryptFileWallet, readWallet } from '../wallet/storage'
import { formatXE, withNetwork as xeWithNetwork } from '../transaction/xe'
import { toDays, toUpperCaseFirst } from '../helpers'

const stakeTypes = ['host', 'gateway', 'stargate']

const formatTime = (t: number): string => {
  const d = new Date(t)
  const [yyyy, mm, dd, h, m, s] = [
    d.getUTCFullYear(),
    (1 + d.getUTCMonth()).toString().padStart(2, '0'),
    (1 + d.getUTCDate()).toString().padStart(2, '0'),
    d.getUTCHours().toString().padStart(2, '0'),
    d.getUTCMinutes().toString().padStart(2, '0'),
    d.getUTCSeconds().toString().padStart(2, '0')
  ]
  return `${yyyy}-${mm}-${dd} ${h}:${m}:${s}`
}

const formatStake = (stake: xe.stake.Stake): string => {
  const lines = [
    `ID: ${stake.id}`,
    `Hash: ${stake.hash}`,
    `Tx: ${stake.transaction}`,
    `Amount: ${formatXE(stake.amount)}`,
    `Created: ${formatTime(stake.created)}`,
    `Type: ${toUpperCaseFirst(stake.type)}`
  ]
  if (stake.released !== undefined) lines.push('Status: Released')
  else if (stake.unlockRequested !== undefined) {
    const unlockAt = stake.unlockRequested + stake.unlockPeriod
    if (unlockAt > Date.now()) lines.push(`Status: Unlocking (unlocks at ${formatTime(unlockAt)})`)
    else lines.push('Status: Unlocked')
  }
  else lines.push('Status: Active')
  return lines.join('\n')
}

const createAction = (parent: Command, createCmd: Command, network: Network) => async (stakeType: string) => {
  if (!stakeTypes.includes(stakeType)) throw new Error(`invalid stake type "${stakeType}"`)

  const opts = {
    ...walletCLI.getWalletOption(parent),
    ...walletCLI.getPassphraseOption(createCmd),
    ...(() => {
      const { yes } = createCmd.opts<{ yes: boolean }>()
      return { yes }
    })()
  }

  const vars = await xe.vars(network.blockchain.baseURL)

  const encWallet = await readWallet(opts.wallet)

  const api = xeWithNetwork(network)
  const onChainWallet = await api.walletWithNextNonce(encWallet.address)

  // fallback 0 is just for typing - stakeType is checked at top of func, so it should never be used
  const amount =
    stakeType === 'host' ? vars.host_stake_amount :
      stakeType === 'gateway' ? vars.gateway_stake_amount :
        stakeType === 'stargate' ? vars.stargate_stake_amount : 0

  const resultBalance = onChainWallet.balance - amount
  // eslint-disable-next-line max-len
  if (resultBalance < 0) throw new Error(`insufficient balance to stake ${stakeType}: your wallet only contains ${formatXE(onChainWallet.balance)} (${formatXE(amount)} required)`)

  if (!opts.yes) {
    // eslint-disable-next-line max-len
    console.log(`You are staking ${formatXE(amount)} to run a ${toUpperCaseFirst(stakeType)}.`)
    console.log(
      `${formatXE(amount)} will be deducted from your available balance.`,
      `You will have ${formatXE(resultBalance)} remaining.`
    )
    console.log()
    let confirm = ''
    const ynRegexp = /^[yn]$/
    while (confirm.length === 0) {
      const input = await ask('Proceed with staking? [yn] ')
      if (ynRegexp.test(input)) confirm = input
      else console.log('Please enter y or n.')
    }
    if (confirm === 'n') return
    console.log()
  }

  await askToSignTx(opts)
  const wallet = decryptFileWallet(encWallet, opts.passphrase as string)

  const tx = xe.tx.sign({
    timestamp: Date.now(),
    sender: wallet.address,
    recipient: wallet.address,
    amount,
    data: {
      action: 'create_stake',
      memo: `Create ${toUpperCaseFirst(stakeType)} stake`
    },
    nonce: onChainWallet.nonce
  }, wallet.privateKey)

  const result = await api.createTransaction(tx)
  if (result.metadata.accepted !== 1) {
    console.log('There was a problem creating your transaction. The response from the blockchain is shown below:')
    console.log()
    console.log(JSON.stringify(result, undefined, 2))
    process.exitCode = 1
  }
  else {
    console.log('Your transaction has been submitted and will appear in the explorer shortly.')
    console.log()
    console.log(`${network.explorer.baseURL}/transaction/${result.results[0].hash}`)
  }
}

const infoAction = (infoCmd: Command, network: Network) => async () => {
  const opts = getJsonOption(infoCmd)
  const vars = await xe.vars(network.blockchain.baseURL)
  if (opts.json) {
    console.log(JSON.stringify(vars, undefined, 2))
    return
  }

  const amounts = [
    vars.host_stake_amount,
    vars.gateway_stake_amount,
    vars.stargate_stake_amount
  ].map(mxe => formatXE(mxe))
  const longest = amounts.reduce((l, s) => Math.max(l, s.length), 0)
  const [hostAmt, gatewayAmt, stargateAmt] = amounts.map(a => a.padStart(longest, ' '))

  console.log('Current staking amounts:')
  console.log(`  Host:     ${hostAmt}`)
  console.log(`  Gateway:  ${gatewayAmt}`)
  console.log(`  Stargate: ${stargateAmt}`)
}

const listAction = (parent: Command, listCmd: Command, network: Network) => async () => {
  const opts = {
    ...walletCLI.getWalletOption(parent),
    ...getJsonOption(listCmd)
  }

  const encWallet = await readWallet(opts.wallet)
  const stakes = await xe.stake.stakes(network.blockchain.baseURL, encWallet.address)

  if (opts.json) {
    console.log(JSON.stringify(stakes, undefined, 2))
    return
  }

  Object.values(stakes)
    .map(stake => formatStake(stake))
    .forEach(stake => {
      console.log(stake)
      console.log()
    })
}

const releaseAction = (parent: Command, releaseCmd: Command, network: Network) => async (id: string) => {
  const opts = {
    ...walletCLI.getWalletOption(parent),
    ...walletCLI.getPassphraseOption(releaseCmd),
    ...(() => {
      const { express, yes } = releaseCmd.opts<{ express: boolean, yes: boolean }>()
      return { express, yes }
    })()
  }

  const encWallet = await readWallet(opts.wallet)
  const stakes = await xe.stake.stakes(network.blockchain.baseURL, encWallet.address)

  // find stake by hash, or by id as fallback
  const stake =
    Object.values(stakes).find(stake => stake.hash === id)
    || Object.values(stakes).find(stake => stake.id === id)
  if (!stake) throw new Error(`unrecognized stake "${id}"`)

  if (stake.released !== undefined) {
    console.log('This stake has already been released.')
    return
  }

  if (stake.unlockRequested === undefined) {
    console.log('This stake must be unlocked before it can be released.')
    return
  }

  const unlockAt = stake.unlockRequested + stake.unlockPeriod
  const needUnlock = unlockAt > Date.now()
  if (needUnlock && !opts.express) {
    const { stake_express_release_fee } = await xe.vars(network.blockchain.baseURL)
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
      const { stake_express_release_fee } = await xe.vars(network.blockchain.baseURL)
      const releaseFee = stake_express_release_fee * stake.amount
      const releasePc = stake_express_release_fee * 100
      console.log([
        `${formatXE(stake.amount - releaseFee)} will be returned to your available balance after paying `,
        `a ${releasePc}% express release fee (${formatXE(releaseFee)}).`
      ].join(''))
    }
    else console.log(`${formatXE(stake.amount)} will be returned to your available balance.`)
    console.log()
    let confirm = ''
    const ynRegexp = /^[yn]$/
    while (confirm.length === 0) {
      const input = await ask('Proceed with release? [yn] ')
      if (ynRegexp.test(input)) confirm = input
      else console.log('Please enter y or n.')
    }
    if (confirm === 'n') return
    console.log()
  }

  await askToSignTx(opts)
  const wallet = decryptFileWallet(encWallet, opts.passphrase as string)
  const api = xeWithNetwork(network)
  const onChainWallet = await api.walletWithNextNonce(wallet.address)

  const data: xe.tx.TxData = {
    action: 'release_stake',
    memo: 'Release stake',
    stake: stake.hash
  }
  if (needUnlock) data.express = true
  const tx = xe.tx.sign({
    timestamp: Date.now(),
    sender: wallet.address,
    recipient: wallet.address,
    amount: 0,
    data,
    nonce: onChainWallet.nonce
  }, wallet.privateKey)

  const result = await api.createTransaction(tx)
  if (result.metadata.accepted !== 1) {
    console.log('There was a problem creating your transaction. The response from the blockchain is shown below:')
    console.log()
    console.log(JSON.stringify(result, undefined, 2))
    process.exitCode = 1
  }
  else {
    console.log('Your transaction has been submitted and will appear in the explorer shortly.')
    console.log()
    console.log(`${network.explorer.baseURL}/transaction/${result.results[0].hash}`)
  }
}

const releaseHelp = [
  '\n',
  'The --express option instructs the blockchain to take a portion of your stake in return for an immediate ',
  'release of funds, rather than waiting for the unlock period to conclude.'
].join('')

const unlockAction = (parent: Command, unlockCmd: Command, network: Network) => async (id: string) => {
  const opts = {
    ...walletCLI.getWalletOption(parent),
    ...walletCLI.getPassphraseOption(unlockCmd),
    ...(() => {
      const { yes } = unlockCmd.opts<{ yes: boolean }>()
      return { yes }
    })()
  }

  const encWallet = await readWallet(opts.wallet)
  const stakes = await xe.stake.stakes(network.blockchain.baseURL, encWallet.address)

  // find stake by hash, or by id as fallback
  const stake =
    Object.values(stakes).find(stake => stake.hash === id)
    || Object.values(stakes).find(stake => stake.id === id)
  if (!stake) throw new Error(`unrecognized stake "${id}"`)

  if (stake.unlockRequested !== undefined) {
    if (stake.unlockRequested + stake.unlockPeriod > Date.now()) {
      console.log('Unlock has already been requested.')
      console.log(`This stake will unlock at ${formatTime(stake.unlockRequested)}`)
    }
    else console.log('This stake is already unlocked.')
    return
  }

  if (!opts.yes) {
    // eslint-disable-next-line max-len
    console.log(`You are requesting to unlock a ${toUpperCaseFirst(stake.type)} stake.`)
    console.log([
      `After the unlock wait period of ${toDays(stake.unlockPeriod)} days, `,
      `you will be able to release the stake and return ${formatXE(stake.amount)} to your available balance.`
    ].join(''))
    console.log()
    let confirm = ''
    const ynRegexp = /^[yn]$/
    while (confirm.length === 0) {
      const input = await ask('Proceed with unlock? [yn] ')
      if (ynRegexp.test(input)) confirm = input
      else console.log('Please enter y or n.')
    }
    if (confirm === 'n') return
    console.log()
  }

  await askToSignTx(opts)
  const wallet = decryptFileWallet(encWallet, opts.passphrase as string)
  const api = xeWithNetwork(network)
  const onChainWallet = await api.walletWithNextNonce(wallet.address)

  const tx = xe.tx.sign({
    timestamp: Date.now(),
    sender: wallet.address,
    recipient: wallet.address,
    amount: 0,
    data: {
      action: 'unlock_stake',
      memo: 'Unlock stake',
      stake: stake.hash
    },
    nonce: onChainWallet.nonce
  }, wallet.privateKey)

  const result = await api.createTransaction(tx)
  if (result.metadata.accepted !== 1) {
    console.log('There was a problem creating your transaction. The response from the blockchain is shown below:')
    console.log()
    console.log(JSON.stringify(result, undefined, 2))
    process.exitCode = 1
  }
  else {
    console.log('Your transaction has been submitted and will appear in the explorer shortly.')
    console.log()
    console.log(`${network.explorer.baseURL}/transaction/${result.results[0].hash}`)
  }
}

const getJsonOption = (cmd: Command) => {
  type JsonOption = { json: boolean }
  const { json } = cmd.opts<JsonOption>()
  return <JsonOption>{ json }
}

export const withProgram = (parent: Command, network: Network): void => {
  const stakeCLI = new Command('stake')
    .description('manage stakes')

  // edge stake create
  const create = new Command('create')
    .argument('<type>', `type of stake (${stakeTypes.join('|')})`)
    .description('create a new stake')
    .addOption(walletCLI.passphraseOption())
    .addOption(walletCLI.passphraseFileOption())
    .option('-y, --yes', 'do not ask for confirmation')
  create.action(errorHandler(parent, createAction(parent, create, network)))

  // edge stake info
  const info = new Command('info')
    .description('get on-chain staking information')
    .option('--json', 'display info as json')
  info.action(errorHandler(parent, infoAction(info, network)))

  // edge stake ls
  const list = new Command('list')
    .alias('ls')
    .description('list all stakes')
    .option('--json', 'display stakes as json')
  list.action(errorHandler(parent, listAction(parent, list, network)))

  // edge stake release
  const release = new Command('release')
    .argument('<id>', 'stake ID')
    .description('release a stake')
    .option('-e, --express', 'express release')
    .addOption(walletCLI.passphraseOption())
    .addOption(walletCLI.passphraseFileOption())
    .option('-y, --yes', 'do not ask for confirmation')
    .addHelpText('after', releaseHelp)
  release.action(errorHandler(parent, releaseAction(parent, release, network)))

  // edge stake unlock
  const unlock = new Command('unlock')
    .argument('<id>', 'stake ID or hash')
    .description('unlock a stake')
    .addOption(walletCLI.passphraseOption())
    .addOption(walletCLI.passphraseFileOption())
    .option('-y, --yes', 'do not ask for confirmation')
  unlock.action(errorHandler(parent, unlockAction(parent, unlock, network)))

  stakeCLI
    .addCommand(create)
    .addCommand(info)
    .addCommand(list)
    .addCommand(release)
    .addCommand(unlock)

  parent.addCommand(stakeCLI)
}
