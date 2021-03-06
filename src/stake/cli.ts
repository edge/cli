// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { checkVersionHandler } from '../update/cli'
import config from '../config'
import { formatXE } from '../transaction/xe'
import { tx as xeTx } from '@edge/xe-utils'
import { Command, Option } from 'commander'
import { CommandContext, Context, Network, XEClientProvider } from '..'
import { askLetter, getYesOption, yesOption } from '../input'
import { askToSignTx, handleCreateTxResult } from '../transaction'
import { errorHandler, getDebugOption, getVerboseOption } from '../edge/cli'
import { findOne, types } from '.'
import { getPassphraseOption, passphraseFileOption, passphraseOption } from '../wallet/cli'
import { printData, toDays, toUpperCaseFirst } from '../helpers'

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

// wrapper for xe.vars; returns the original error in --debug CLI, otherwise generic error message
const xeVars = async (xe: XEClientProvider, debug: boolean) => {
  try {
    return await xe().vars()
  }
  catch (err) {
    if (debug) throw err
    throw new Error('staking is currently unavailable. Please try again later.')
  }
}

const createAction = ({ logger, wallet, xe, ...ctx }: CommandContext) => async (nodeType: string) => {
  if (!types.includes(nodeType)) throw new Error(`invalid node type "${nodeType}"`)
  const log = logger()

  const opts = {
    ...getDebugOption(ctx.parent),
    ...await getPassphraseOption(ctx.cmd),
    ...getYesOption(ctx.cmd)
  }
  log.debug('options', opts)

  const storage = wallet()
  const address = await storage.address()

  const xeClient = xe()
  const onChainWallet = await xeClient.walletWithNextNonce(address)

  const vars = await xeVars(xe, opts.debug)
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
    if (await askLetter('Proceed with staking?', 'yn') === 'n') return
    console.log()
  }

  await askToSignTx(opts)
  const userWallet = await storage.read(opts.passphrase as string)

  const tx = xeTx.sign({
    timestamp: Date.now(),
    sender: userWallet.address,
    recipient: userWallet.address,
    amount,
    data: {
      action: 'create_stake',
      memo: `Create ${toUpperCaseFirst(nodeType)} Stake`
    },
    nonce: onChainWallet.nonce
  }, userWallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(ctx.network, result)) process.exitCode = 1
}

const createHelp = (network: Network) => [
  '\n',
  'This command will create a stake on the blockchain.\n\n',
  'A stake enables your device to participate as a node in the network, providing capacity in exchange for XE.\n\n',
  `Run '${network.appName} device add --help' for more information.`
].join('')

const infoAction = ({ xe, ...ctx }: CommandContext) => async () => {
  const { debug } = getDebugOption(ctx.parent)

  const vars = await xeVars(xe, debug)

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

const listAction = ({ index, wallet, ...ctx }: CommandContext) => async () => {
  const { verbose } = getVerboseOption(ctx.parent)
  const printID = (id: string) => verbose ? id : id.slice(0, config.id.shortLength)

  const storage = wallet()
  const address = await storage.address()
  const { results: stakes } = await index().stakes(address, { limit: 999 })

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

const listHelp = '\nDisplays all stakes associated with your wallet.'

const releaseAction = ({ index, wallet, xe, ...ctx }: CommandContext) => async (id: string) => {
  const opts = {
    ...getDebugOption(ctx.parent),
    ...await getPassphraseOption(ctx.cmd),
    ...getExpressOption(ctx.cmd),
    ...getYesOption(ctx.cmd)
  }

  const storage = wallet()
  const { results: stakes } = await index().stakes(await storage.address(), { limit: 999 })
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
    const { stake_express_release_fee } = await xeVars(xe, opts.debug)
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
      const { stake_express_release_fee } = await xeVars(xe, opts.debug)
      const releaseFee = stake_express_release_fee * stake.amount
      const releasePc = stake_express_release_fee * 100
      console.log([
        `${formatXE(stake.amount - releaseFee)} will be returned to your available balance after paying `,
        `a ${releasePc}% express release fee (${formatXE(releaseFee)}).`
      ].join(''))
    }
    else console.log(`${formatXE(stake.amount)} will be returned to your available balance.`)
    console.log()
    if (await askLetter('Proceed with release?', 'yn') === 'n') return
    console.log()
  }

  await askToSignTx(opts)
  const userWallet = await storage.read(opts.passphrase as string)

  const xeClient = xe()
  const onChainWallet = await xeClient.walletWithNextNonce(userWallet.address)

  const data: xeTx.TxData = {
    action: 'release_stake',
    memo: 'Release Stake',
    stake: stake.hash
  }
  if (needUnlock) data.express = true
  const tx = xeTx.sign({
    timestamp: Date.now(),
    sender: userWallet.address,
    recipient: userWallet.address,
    amount: 0,
    data,
    nonce: onChainWallet.nonce
  }, userWallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(ctx.network, result)) process.exitCode = 1
}

const releaseHelp = [
  '\n',
  'Release a stake.\n\n',
  'The --express option instructs the blockchain to take a portion of your stake in return for an immediate ',
  'release of funds, rather than waiting for the unlock period to conclude.'
].join('')

const unlockAction = ({ index, logger, wallet, xe, ...ctx }: CommandContext) => async (id: string) => {
  const log = logger()

  const opts = {
    ...await getPassphraseOption(ctx.cmd),
    ...getYesOption(ctx.cmd)
  }
  log.debug('options', opts)

  const storage = wallet()
  const { results: stakes } = await index().stakes(await storage.address(), { limit: 999 })
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
    if (await askLetter('Proceed with unlock?', 'yn') === 'n') return
    console.log()
  }

  await askToSignTx(opts)
  const userWallet = await storage.read(opts.passphrase as string)

  const xeClient = xe()
  const onChainWallet = await xeClient.walletWithNextNonce(userWallet.address)

  const tx = xeTx.sign({
    timestamp: Date.now(),
    sender: userWallet.address,
    recipient: userWallet.address,
    amount: 0,
    data: {
      action: 'unlock_stake',
      memo: 'Unlock Stake',
      stake: stake.hash
    },
    nonce: onChainWallet.nonce
  }, userWallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(ctx.network, result)) process.exitCode = 1
}

const unlockHelp = [
  '\n',
  'Unlock a stake.'
].join('')

const getExpressOption = (cmd: Command): { express: boolean } => {
  const opts = cmd.opts<{ express: boolean }>()
  return { express: !!opts.express }
}

const expressOption = (description = 'express release') => new Option('-e, --express', description)

export const withContext = (ctx: Context): Command => {
  const stakeCLI = new Command('stake')
    .description('manage stakes')

  // edge stake create
  const create = new Command('create')
    .argument('<type>', `node type (${types.join('|')})`)
    .description('create a new stake')
    .addHelpText('after', createHelp(ctx.network))
    .addOption(passphraseOption())
    .addOption(passphraseFileOption())
    .addOption(yesOption())
  create.action(errorHandler(ctx, checkVersionHandler(ctx, createAction({ ...ctx, cmd: create }))))

  // edge stake info
  const info = new Command('info')
    .description('get on-chain staking information')
    .addHelpText('after', infoHelp)
  info.action(errorHandler(ctx, checkVersionHandler(ctx, infoAction({ ...ctx, cmd: info }))))

  // edge stake ls
  const list = new Command('list')
    .alias('ls')
    .description('list all stakes')
    .addHelpText('after', listHelp)
  list.action(errorHandler(ctx, checkVersionHandler(ctx, listAction({ ...ctx, cmd: list }))))

  // edge stake release
  const release = new Command('release')
    .argument('<id>', 'stake ID')
    .description('release a stake')
    .addHelpText('after', releaseHelp)
    .addOption(expressOption())
    .addOption(passphraseOption())
    .addOption(passphraseFileOption())
    .addOption(yesOption())
  release.action(errorHandler(ctx, checkVersionHandler(ctx, releaseAction({ ...ctx, cmd: release }))))

  // edge stake unlock
  const unlock = new Command('unlock')
    .argument('<id>', 'stake ID')
    .description('unlock a stake')
    .addHelpText('after', unlockHelp)
    .addOption(passphraseOption())
    .addOption(passphraseFileOption())
    .addOption(yesOption())
  unlock.action(errorHandler(ctx, checkVersionHandler(ctx, unlockAction({ ...ctx, cmd: unlock }))))

  stakeCLI
    .addCommand(create)
    .addCommand(info)
    .addCommand(list)
    .addCommand(release)
    .addCommand(unlock)

  return stakeCLI
}
