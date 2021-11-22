// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as data from './data'
import * as service from './service'
import * as walletCLI from '../wallet/cli'
import * as xe from '@edge/xe-utils'
import { Network } from '../main'
import { ask } from '../input'
import { askToSignTx } from '../transaction'
import { checkVersionHandler } from '../update/cli'
import config from '../config'
import { toUpperCaseFirst } from '../helpers'
import { withNetwork as xeWithNetwork } from '../transaction/xe'
import { Command, Option } from 'commander'
import Docker, { DockerOptions } from 'dockerode'
import { decryptFileWallet, readWallet } from '../wallet/storage'
import { errorHandler, getVerboseOption } from '../edge/cli'

// dummy value for testing docker interactions - replace with staking integration later
const imageName = 'registry.edge.network/library/nginx'

const registerAction = (parent: Command, registerCmd: Command, network: Network) => async (stakeHash: string) => {
  const opts = {
    ...walletCLI.getWalletOption(parent, network),
    ...walletCLI.getPassphraseOption(registerCmd),
    ...(() => {
      const { yes } = registerCmd.opts<{ yes: boolean }>()
      return { yes }
    })()
  }

  const docker = new Docker(getDockerOptions(registerCmd))
  const volume = await data.volume(docker)

  const deviceWallet = await (async () => {
    let w: data.Data | undefined = undefined
    try {
      console.log('Reading device data...')
      w = await data.read(docker, volume)
    }
    catch (err) {
      console.log(err)
      console.log('Initializing device data...')
      w = { ...xe.wallet.create(), network: network.name }
      await data.write(docker, volume, w)
    }
    return w as data.Data
  })()

  const encWallet = await readWallet(opts.wallet)
  const stakes = await xe.stake.stakes(network.blockchain.baseURL, encWallet.address)

  // TODO interactive stake selection
  const stake = Object.values(stakes).find(s => s.hash === stakeHash)
  if (stake === undefined) throw new Error(`no stake with hash ${stakeHash}`)

  const assigned = Object.values(stakes).find(s => s.device === deviceWallet.address)
  if (assigned !== undefined) {
    if (assigned.id === stake.id) console.log('This device is already assigned to the requested stake.')
    else {
      console.log(`This device is already assigned to a ${toUpperCaseFirst(assigned.type)} stake: ${assigned.hash}`)
      console.log([
        'To reassign this device, run \'edge device remove\' first to remove it from the network, then run ',
        '\'edge device register\' again to re-register it.'
      ].join(''))
    }
    return
  }

  if (!opts.yes) {
    console.log(`You are assigning this device to the ${toUpperCaseFirst(stake.type)} stake ${stake.hash}.`)
    console.log(`This will allow the device to run a ${toUpperCaseFirst(stake.type)} node.`)
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
  const wallet = decryptFileWallet(encWallet, opts.passphrase as string)
  const api = xeWithNetwork(network)
  const onChainWallet = await api.walletWithNextNonce(wallet.address)

  const txData: xe.tx.TxData = {
    action: 'assign_device',
    device: deviceWallet.address,
    memo: 'Assign device to stake',
    stake: stake.hash
  }
  const tx = xe.tx.sign({
    timestamp: Date.now(),
    sender: wallet.address,
    recipient: wallet.address,
    amount: 0,
    data: txData,
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

  const container = docker.getContainer(info.Id)
  await new Promise<unknown>((resolve, reject) => container.stop((err, result) => {
    if (err !== null) return reject(err)
    return resolve(result)
  }))
  await new Promise<unknown>((resolve, reject) => container.remove((err, result) => {
    if (err !== null) return reject(err)
    return resolve(result)
  }))

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

  // edge device register
  const register = new Command('register')
    .argument('[hash]', 'stake hash')
    .description('register this device on the network')
    .addOption(socketPathOption())
    .option('-y, --yes', 'do not ask for confirmation')
  register.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        registerAction(parent, register, network)
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
    .addCommand(register)
    .addCommand(restart)
    .addCommand(start)
    .addCommand(status)
    .addCommand(stop)

  parent.addCommand(deviceCLI)
}
