// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as xe from '@edge/xe-utils'
import { Command } from 'commander'
import { formatXE } from '../transaction/xe'
import { errorHandler, getOptions as getGlobalOptions } from '../edge/cli'

const createAction = (parent: Command) => () => {
  console.debug('stake create WIP', parent.opts())
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
    .description('assign a new stake to this device')
    .action(createAction(parent))

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
