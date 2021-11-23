// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as data from './data'
import * as service from './service'
import * as walletCLI from '../wallet/cli'
import * as xe from '@edge/xe-utils'
import { Network } from '../main'
import { ask } from '../input'
import { checkVersionHandler } from '../update/cli'
import config from '../config'
import { toUpperCaseFirst } from '../helpers'
import { withFile } from '../wallet/storage'
import { withNetwork as xeWithNetwork } from '../transaction/xe'
import { Command, Option } from 'commander'
import Docker, { DockerOptions } from 'dockerode'
import { askToSignTx, handleCreateTxResult } from '../transaction'
import { errorHandler, getVerboseOption } from '../edge/cli'

// dummy value for testing docker interactions - replace with staking integration later
const imageName = 'registry.edge.network/library/nginx'

const addAction = (parent: Command, addCmd: Command, network: Network) => async (stakeHash: string) => {
  const opts = {
    ...walletCLI.getWalletOption(parent, network),
    ...walletCLI.getPassphraseOption(addCmd),
    ...(() => {
      const { yes } = addCmd.opts<{ yes: boolean }>()
      return { yes }
    })()
  }
  const storage = withFile(opts.wallet)
  const docker = new Docker(getDockerOptions(addCmd))

  const dataVolume = data.withVolume(docker, await data.volume(docker))
  const device = await (async () => {
    let w: data.Device | undefined = undefined
    try {
      console.log('Reading device data...')
      w = await dataVolume.read()
    }
    catch (err) {
      console.log(err)
      console.log('Initializing device data...')
      w = { ...xe.wallet.create(), network: network.name }
      await dataVolume.write(w)
    }
    return w as data.Device
  })()

  const stakes = await xe.stake.stakes(network.blockchain.baseURL, await storage.address())
  // TODO interactive stake selection
  const stake = Object.values(stakes).find(s => s.hash === stakeHash)
  if (stake === undefined) throw new Error(`no stake with hash ${stakeHash}`)

  const assigned = Object.values(stakes).find(s => s.device === device.address)
  if (assigned !== undefined) {
    if (assigned.id === stake.id) console.log('This device is already assigned to the requested stake.')
    else {
      console.log(`This device is already assigned to a ${toUpperCaseFirst(assigned.type)} stake: ${assigned.hash}`)
      console.log([
        'To reassign this device, run \'edge device remove\' first to remove it from the network, then run ',
        '\'edge device add\' again to add it back.'
      ].join(''))
    }
    return
  }

  if (!opts.yes) {
    console.log('You are adding this device to the network.')
    console.log([
      `This will assign the ${toUpperCaseFirst(stake.type)} stake ${stake.hash}, `,
      `allowing this device to run a ${toUpperCaseFirst(stake.type)} node.`
    ].join(''))
    console.log()
    let confirm = ''
    const ynRegexp = /^[yn]$/
    while (confirm.length === 0) {
      const input = await ask('Proceed with assignment? [yn] ')
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
      action: 'assign_device',
      device: device.address,
      memo: 'Assign device to stake',
      stake: stake.hash
    },
    nonce: onChainWallet.nonce
  }, wallet.privateKey)

  const result = await api.createTransaction(tx)
  if (!handleCreateTxResult(network, result)) process.exitCode = 1
}

const removeAction = (parent: Command, removeCmd: Command, network: Network) => async () => {
  const opts = {
    ...walletCLI.getWalletOption(parent, network),
    ...walletCLI.getPassphraseOption(removeCmd),
    ...(() => {
      const { yes } = removeCmd.opts<{ yes: boolean }>()
      return { yes }
    })()
  }
  const storage = withFile(opts.wallet)
  const docker = new Docker(getDockerOptions(removeCmd))

  const dataVolume = data.withVolume(docker, await data.volume(docker, false))
  const device = await dataVolume.read()

  const stakes = await xe.stake.stakes(network.blockchain.baseURL, await storage.address())
  const stake = Object.values(stakes).find(s => s.device === device.address)

  if (!opts.yes) {
    console.log('You are removing this device from the network.')
    if (stake !== undefined) console.log(`This will unassign the ${toUpperCaseFirst(stake.type)} stake ${stake.hash}.`)
    else console.log('This device does not currently have a stake assigned.')
    console.log()
    let confirm = ''
    const ynRegexp = /^[yn]$/
    while (confirm.length === 0) {
      const input = await ask('Proceed with removal? [yn] ')
      if (ynRegexp.test(input)) confirm = input
      else console.log('Please enter y or n.')
    }
    if (confirm === 'n') return
    console.log()
  }

  if (stake !== undefined) {
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
        action: 'unassign_device',
        memo: 'Unassign device from stake',
        stake: stake.hash
      },
      nonce: onChainWallet.nonce
    }, wallet.privateKey)

    console.log('Unassigning stake...')
    const result = await api.createTransaction(tx)
    if (!handleCreateTxResult(network, result)) {
      process.exitCode = 1
      return
    }
  }

  const info = await service.info(docker, imageName)
  if (info !== undefined) {
    console.log('Stopping service...')
    await service.stop(docker, info)
    console.log('Stopped')
  }

  console.log('Removing device...')
  await dataVolume.remove()
  console.log('This device has been removed from the network.')
}

const restartAction = (parent: Command, restartCmd: Command) => async () => {
  const opts = {
    ...getVerboseOption(parent)
  }
  const docker = new Docker(getDockerOptions(restartCmd))

  const info = await service.info(docker, imageName)
  if (info === undefined) {
    console.log('Service is not running. Use `device start` instead')
    return
  }

  const container = docker.getContainer(info.Id)
  await new Promise<unknown>((resolve, reject) => container.restart((err, result) => {
    if (err !== null) return reject(err)
    return resolve(result)
  }))

  console.log('Service restarted')
  if (opts.verbose) console.log(info.Id)
}

const startAction = (parent: Command, startCmd: Command) => async () => {
  const opts = {
    ...getVerboseOption(parent)
  }
  const docker = new Docker(getDockerOptions(startCmd))

  let info = await service.info(docker, imageName)
  if (info !== undefined) {
    console.log('Service is already running')
    if (opts.verbose) console.log(info.Id)
    return
  }

  const container = await docker.createContainer({
    Image: imageName,
    AttachStdin: false,
    AttachStdout: false,
    AttachStderr: false,
    Tty: false,
    OpenStdin: false,
    StdinOnce: false
  })

  await new Promise<unknown>((resolve, reject) => container.start((err, result) => {
    if (err !== null) return reject(err)
    return resolve(result)
  }))

  info = await service.info(docker, imageName)
  if (info === undefined) throw new Error('Service failed to start')
  console.log('Service started')
  if (opts.verbose) console.log(info.Id)
}

const statusAction = (parent: Command, statusCmd: Command) => async () => {
  const opts = {
    ...getVerboseOption(parent)
  }
  const docker = new Docker(getDockerOptions(statusCmd))

  const info = await service.info(docker, imageName)
  if (info === undefined) console.log('Service is not running')
  else {
    console.log('Service is running')
    if (opts.verbose) console.log(info.Id)
  }
}

const stopAction = (parent: Command, stopCmd: Command) => async () => {
  const opts = {
    ...getVerboseOption(parent)
  }
  const docker = new Docker(getDockerOptions(stopCmd))

  const info = await service.info(docker, imageName)
  if (info === undefined) {
    console.log('Service is not running')
    return
  }

  await service.stop(docker, info)
  console.log('Service stopped')
  if (opts.verbose) console.log(info.Id)
}

const getDockerOptions = (cmd: Command): DockerOptions => {
  type Input = {
    dockerSocketPath?: string
  }
  const opts = cmd.opts<Input>()

  return {
    socketPath: opts.dockerSocketPath || config.docker.socketPath
  }
}

const socketPathOption = () => new Option('--docker-socket-path', 'Docker socket path')

export const withProgram = (parent: Command, network: Network): void => {
  const deviceCLI = new Command('device')
    .description('manage device')

  // edge device add
  const add = new Command('add')
    .argument('[hash]', 'stake hash')
    .description('add this device to the network')
    .addOption(socketPathOption())
    .option('-y, --yes', 'do not ask for confirmation')
  add.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        addAction(parent, add, network)
      )
    )
  )

  // edge device remove
  const remove = new Command('remove')
    .description('remove this device from the network')
    .addOption(socketPathOption())
    .option('-y, --yes', 'do not ask for confirmation')
  remove.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        removeAction(parent, remove, network)
      )
    )
  )

  // edge device restart
  const restart = new Command('restart')
    .description('restart services')
    .addOption(socketPathOption())
  restart.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        restartAction(parent, restart)
      )
    )
  )

  // edge device start
  const start = new Command('start')
    .description('start services')
    .addOption(socketPathOption())
  start.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        startAction(parent, start)
      )
    )
  )

  // edge device status
  const status = new Command('status')
    .description('display services status')
    .addOption(socketPathOption())
  status.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        statusAction(parent, status)
      )
    )
  )

  // edge device stop
  const stop = new Command('stop')
    .description('stop services')
    .addOption(socketPathOption())
  stop.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        stopAction(parent, stop)
      )
    )
  )

  deviceCLI
    .addCommand(add)
    .addCommand(remove)
    .addCommand(restart)
    .addCommand(start)
    .addCommand(status)
    .addCommand(stop)

  parent.addCommand(deviceCLI)
}
