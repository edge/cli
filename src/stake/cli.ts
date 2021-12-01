// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as index from '@edge/index-utils'
import * as walletCLI from '../wallet/cli'
import * as xe from '@edge/xe-utils'
import { Command } from 'commander'
import { Network } from '../main'
import { ask } from '../input'
import { checkVersionHandler } from '../update/cli'
import { withFile } from '../wallet/storage'
import { askToSignTx, handleCreateTxResult } from '../transaction'
import { errorHandler, getVerboseOption } from '../edge/cli'
import { findOne, types } from '.'
import { formatXE, withNetwork as xeWithNetwork } from '../transaction/xe'
import { printData, printTrunc, toDays, toUpperCaseFirst } from '../helpers'

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

// wrapper for xe.vars; returns the original error in --verbose CLI, otherwise generic error message
const onChainVars = async (verbose: boolean, host: string) => {
  try {
    return await xe.vars(host)
  }
  catch (err) {
    if (verbose) throw err
    throw new Error('staking is currently unavailable. Please try again later.')
  }
}

const createAction = (parent: Command, createCmd: Command, network: Network) => async (nodeType: string) => {
  if (!types.includes(nodeType)) throw new Error(`invalid node type "${nodeType}"`)

  const opts = {
    ...getVerboseOption(parent),
    ...walletCLI.getWalletOption(parent, network),
    ...walletCLI.getPassphraseOption(createCmd),
    ...(() => {
      const { yes } = createCmd.opts<{ yes: boolean }>()
      return { yes }
    })()
  }
  const storage = withFile(opts.wallet)

  const api = xeWithNetwork(network)
  const onChainWallet = await api.walletWithNextNonce(await storage.address())

  const vars = await onChainVars(opts.verbose, network.blockchain.baseURL)
  // fallback 0 is just for typing - nodeType is checked at top of func, so it should never be used
  const amount =
    nodeType === 'host' ? vars.host_stake_amount :
      nodeType === 'gateway' ? vars.gateway_stake_amount :
        nodeType === 'stargate' ? vars.stargate_stake_amount : 0

  const resultBalance = onChainWallet.balance - amount
  // eslint-disable-next-line max-len
  if (resultBalance < 0) throw new Error(`insufficient balance to stake ${nodeType}: your wallet only contains ${formatXE(onChainWallet.balance)} (${formatXE(amount)} required)`)

  if (!opts.yes) {
    // eslint-disable-next-line max-len
    console.log(`You are staking ${formatXE(amount)} to run a ${toUpperCaseFirst(nodeType)}.`)
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
  const wallet = await storage.read(opts.passphrase as string)

  const tx = xe.tx.sign({
    timestamp: Date.now(),
    sender: wallet.address,
    recipient: wallet.address,
    amount,
    data: {
      action: 'create_stake',
      memo: `Create ${toUpperCaseFirst(nodeType)} Stake`
    },
    nonce: onChainWallet.nonce
  }, wallet.privateKey)

  const result = await api.createTransaction(tx)
  if (!handleCreateTxResult(network, result)) process.exitCode = 1
}

const createHelp = (network: Network) => [
  '\n',
  'This command will create a stake on the blockchain.\n\n',
  'A stake enables your device to participate as a node in the network, providing capacity in exchange for XE.\n\n',
  `Run '${network.appName} device add --help' for more information.`
].join('')

const infoAction = (parent: Command, infoCmd: Command, network: Network) => async () => {
  const opts = {
    ...getVerboseOption(parent),
    ...getJsonOption(infoCmd)
  }
  const vars = await onChainVars(opts.verbose, network.blockchain.baseURL)
  if (opts.json) {
    const someVars = {
      host_stake_amount: vars.host_stake_amount,
      gateway_stake_amount: vars.gateway_stake_amount,
      stargate_stake_amount: vars.stargate_stake_amount
    }
    console.log(JSON.stringify(someVars, undefined, 2))
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
  console.log(`  Stargate: ${stargateAmt}`)
  console.log(`  Gateway:  ${gatewayAmt}`)
  console.log(`  Host:     ${hostAmt}`)
}

const infoHelp = '\nDisplays current staking amounts.'

const listAction = (parent: Command, listCmd: Command, network: Network) => async () => {
  const opts = {
    ...walletCLI.getWalletOption(parent, network),
    ...getJsonOption(listCmd),
    ...(() => {
      const { fullIds } = listCmd.opts<{ fullIds: boolean }>()
      return { fullIds }
    })()
  }
  const printID = printTrunc(!opts.fullIds, 8)

  const storage = withFile(opts.wallet)
  const { results: stakes } = await index.stake.stakes(network.index.baseURL, await storage.address(), { limit: 999 })

  if (opts.json) {
    console.log(JSON.stringify(stakes, undefined, 2))
    return
  }
  Object.values(stakes).forEach(stake => {
    const data: Record<string, string> = {
      ID: printID(stake.id),
      Hash: printID(stake.hash),
      Tx: stake.transaction,
      Created: formatTime(stake.created),
      ...(() => {
        if (stake.device !== undefined) {
          return {
            Device: stake.device,
            Assigned: formatTime(stake.deviceAssigned as number)
          }
        }
      })(),
      Amount: formatXE(stake.amount),
      Type: toUpperCaseFirst(stake.type)
    }

    if (stake.released !== undefined) data.Status = 'Released'
    else if (stake.unlockRequested !== undefined) {
      const unlockAt = stake.unlockRequested + stake.unlockPeriod
      if (unlockAt > Date.now()) data.Status = `Unlocking (unlocks at ${formatTime(unlockAt)})`
      else data.Status = 'Unlocked'
    }
    else data.Status = 'Active'

    console.log(printData(data))
    console.log()
  })
}

const listHelp = [
  '\n',
  'Displays all stakes associated with your wallet.\n\n',
  'The default output is simplified for legibility. Provide the --json option to display full detail.'
].join('')

const releaseAction = (parent: Command, releaseCmd: Command, network: Network) => async (id: string) => {
  const opts = {
    ...getVerboseOption(parent),
    ...walletCLI.getWalletOption(parent, network),
    ...walletCLI.getPassphraseOption(releaseCmd),
    ...(() => {
      const { express, yes } = releaseCmd.opts<{ express: boolean, yes: boolean }>()
      return { express, yes }
    })()
  }
  const storage = withFile(opts.wallet)
  const { results: stakes } = await index.stake.stakes(network.index.baseURL, await storage.address(), { limit: 999 })
  const stake = findOne(stakes, id)

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
    const { stake_express_release_fee } = await onChainVars(opts.verbose, network.blockchain.baseURL)
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
      const { stake_express_release_fee } = await onChainVars(opts.verbose, network.blockchain.baseURL)
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
  const wallet = await storage.read(opts.passphrase as string)

  const api = xeWithNetwork(network)
  const onChainWallet = await api.walletWithNextNonce(wallet.address)

  const data: xe.tx.TxData = {
    action: 'release_stake',
    memo: 'Release Stake',
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
  if (!handleCreateTxResult(network, result)) process.exitCode = 1
}

const releaseHelp = [
  '\n',
  'Release a stake.\n\n',
  'The --express option instructs the blockchain to take a portion of your stake in return for an immediate ',
  'release of funds, rather than waiting for the unlock period to conclude.'
].join('')

const unlockAction = (parent: Command, unlockCmd: Command, network: Network) => async (id: string) => {
  const opts = {
    ...walletCLI.getWalletOption(parent, network),
    ...walletCLI.getPassphraseOption(unlockCmd),
    ...(() => {
      const { yes } = unlockCmd.opts<{ yes: boolean }>()
      return { yes }
    })()
  }
  const storage = withFile(opts.wallet)
  const { results: stakes } = await index.stake.stakes(network.index.baseURL, await storage.address(), { limit: 999 })
  const stake = findOne(stakes, id)

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
  const wallet = await storage.read(opts.passphrase as string)

  const api = xeWithNetwork(network)
  const onChainWallet = await api.walletWithNextNonce(wallet.address)

  const tx = xe.tx.sign({
    timestamp: Date.now(),
    sender: wallet.address,
    recipient: wallet.address,
    amount: 0,
    data: {
      action: 'unlock_stake',
      memo: 'Unlock Stake',
      stake: stake.hash
    },
    nonce: onChainWallet.nonce
  }, wallet.privateKey)

  const result = await api.createTransaction(tx)
  if (!handleCreateTxResult(network, result)) process.exitCode = 1
}

const unlockHelp = [
  '\n',
  'Unlock a stake.'
].join('')

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
    .argument('<type>', `node type (${types.join('|')})`)
    .description('create a new stake')
    .addHelpText('after', createHelp(network))
    .addOption(walletCLI.passphraseOption())
    .addOption(walletCLI.passphraseFileOption())
    .option('-y, --yes', 'do not ask for confirmation')
  create.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        createAction(parent, create, network)
      )
    )
  )

  // edge stake info
  const info = new Command('info')
    .description('get on-chain staking information')
    .addHelpText('after', infoHelp)
    .option('--json', 'display info as json')
  info.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        infoAction(parent, info, network)
      )
    )
  )

  // edge stake ls
  const list = new Command('list')
    .alias('ls')
    .description('list all stakes')
    .addHelpText('after', listHelp)
    .option('-D, --full-ids', 'display full-length IDs (ignored if --json)')
    .option('--json', 'display stakes as json')
  list.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        listAction(parent, list, network)
      )
    )
  )

  // edge stake release
  const release = new Command('release')
    .argument('<id>', 'stake ID')
    .description('release a stake')
    .addHelpText('after', releaseHelp)
    .option('-e, --express', 'express release')
    .addOption(walletCLI.passphraseOption())
    .addOption(walletCLI.passphraseFileOption())
    .option('-y, --yes', 'do not ask for confirmation')
  release.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        releaseAction(parent, release, network)
      )
    )
  )

  // edge stake unlock
  const unlock = new Command('unlock')
    .argument('<id>', 'stake ID')
    .description('unlock a stake')
    .addHelpText('after', unlockHelp)
    .addOption(walletCLI.passphraseOption())
    .addOption(walletCLI.passphraseFileOption())
    .option('-y, --yes', 'do not ask for confirmation')
  unlock.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        unlockAction(parent, unlock, network)
      )
    )
  )

  stakeCLI
    .addCommand(create)
    .addCommand(info)
    .addCommand(list)
    .addCommand(release)
    .addCommand(unlock)

  parent.addCommand(stakeCLI)
}
