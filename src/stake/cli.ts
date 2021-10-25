// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as walletCLI from '../wallet/cli'
import * as xe from '@edge/xe-utils'
import { Command } from 'commander'
import { ask, askSecure } from '../input'
import { decryptFileWallet, readWallet } from '../wallet/storage'
import { errorHandler, getOptions as getGlobalOptions } from '../edge/cli'
import { formatXE, withNetwork as xeWithNetwork } from '../transaction/xe'

const stakeTypes = ['host', 'gateway', 'stargate']

const createAction = (parent: Command, createCmd: Command) => async (stakeType: string) => {
  if (!stakeTypes.includes(stakeType)) throw new Error(`invalid stake type "${stakeType}"`)

  const opts = {
    ...getGlobalOptions(parent),
    ...walletCLI.getWalletOption(parent),
    ...walletCLI.getPassphraseOption(createCmd),
    ...(() => {
      const { yes } = createCmd.opts<{ yes: boolean }>()
      return { yes }
    })()
  }

  const vars = await xe.vars(opts.network.blockchain.baseURL)

  const encWallet = await readWallet(opts.wallet)

  const api = xeWithNetwork(opts.network)
  const onChainWallet = await api.walletWithNextNonce(encWallet.address)

  const amount = (() => {
    if (stakeType === 'host') return vars.host_stake_amount
    else if (stakeType === 'gateway') return vars.gateway_stake_amount
    else if (stakeType === 'stargate') return vars.stargate_stake_amount
    else throw new Error(`no stake amount for "${stakeType}"`)
  })()
  const resultBalance = onChainWallet.balance - amount
  // eslint-disable-next-line max-len
  if (resultBalance < 0) throw new Error(`insufficient balance to stake ${stakeType}: your wallet only contains ${formatXE(onChainWallet.balance)} (${formatXE(amount)} required)`)

  if (!opts.yes) {
    // eslint-disable-next-line max-len
    console.log(`You are staking ${formatXE(amount)} to run a ${stakeType}.`)
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
    if (confirm === 'n') {
      console.log('Stake cancelled. Nothing has been submitted to the blockchain.')
      return
    }
    console.log()
  }

  if (!opts.passphrase) {
    console.log('This staking transaction must be signed with your private key.')
    console.log(
      'Please enter your passphrase to decrypt your private key, sign your staking transaction,',
      'and submit it to the blockchain.'
    )
    console.log('For more information, see https://wiki.edge.network/TODO')
    console.log()
    const passphrase = await askSecure('Passphrase: ')
    if (passphrase.length === 0) throw new Error('passphrase required')
    opts.passphrase = passphrase
    console.log()
  }

  const wallet = decryptFileWallet(encWallet, opts.passphrase)

  const data: xe.tx.TxData = {
    action: 'create_stake',
    memo: (() => {
      if (stakeType === 'host') return 'Create Host stake'
      else if (stakeType === 'gateway') return 'Create Gateway stake'
      else if (stakeType === 'stargate') return 'Create Stargate stake'
      else throw new Error(`no memo for "${stakeType}"`)
    })()
  }
  const tx = xe.tx.sign({
    timestamp: Date.now(),
    sender: wallet.address,
    recipient: wallet.address,
    amount,
    data,
    nonce: onChainWallet.nonce
  }, wallet.privateKey)

  const result = await api.createTransaction(tx)
  if (result.metadata.accepted !== 1) {
    console.log('There was a problem with staking. The response from the blockchain is shown below:')
    console.log()
    console.log(JSON.stringify(result, undefined, 2))
    process.exitCode = 1
  }
  else console.log('Your stake has been submitted to the blockchain.')
}

const infoAction = (parent: Command, infoCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...getJsonOption(infoCmd)
  }
  const vars = await xe.vars(opts.network.blockchain.baseURL)
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
  console.log()
  console.log(`Express release fee: ${vars.stake_express_release_fee} XE`)
}

const listAction = (parent: Command) => () => {
  console.debug('stake ls WIP', parent.opts())
}

const releaseAction = (parent: Command, release: Command) => (id: string) => {
  console.debug('stake release WIP', parent.opts(), release.opts(), id)
}

const unlockAction = (parent: Command) => (id: string) => {
  console.debug('stake unlock WIP', parent.opts(), id)
}

const getJsonOption = (cmd: Command) => {
  type JsonOption = { json: boolean }
  const { json } = cmd.opts<JsonOption>()
  return <JsonOption>{ json }
}

export const withProgram = (parent: Command): void => {
  const stakeCLI = new Command('stake')
    .description('manage stakes')

  // edge stake create
  const create = new Command('create')
    .argument('<type>', `type of stake (${stakeTypes.join('|')})`)
    .description('create a new stake')
    .addOption(walletCLI.passphraseOption())
    .addOption(walletCLI.passphraseFileOption())
    .option('-y, --yes', 'do not ask for confirmation')
  create.action(errorHandler(parent, createAction(parent, create)))

  // edge stake info
  const info = new Command('info')
    .description('get on-chain staking information')
    .option('--json', 'display info as json')
  info.action(errorHandler(parent, infoAction(parent, info)))

  // edge stake ls
  const list = new Command('ls')
    .description('list all stakes')
    .action(listAction(parent))

  // edge stake release
  const release = new Command('release')
    .argument('<id>', 'stake ID')
    .description('release a stake')
    .option('-e, --express', 'express release', false)
    .addHelpText('after', [
      '\n',
      'The --express option instructs the blockchain to take a portion of your stake in return for an immediate ',
      'release of funds, rather than waiting for the unlock period to conclude.'
    ].join(''))
  release.action(releaseAction(parent, release))

  // edge stake unlock
  const unlock = new Command('unlock')
    .argument('<id>', 'stake ID')
    .description('unlock a stake')
    .action(unlockAction(parent))

  stakeCLI
    .addCommand(create)
    .addCommand(info)
    .addCommand(list)
    .addCommand(release)
    .addCommand(unlock)

  parent.addCommand(stakeCLI)
}
