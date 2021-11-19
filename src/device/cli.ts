// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as data from './data'
import * as service from './service'
// import * as walletCLI from '../wallet/cli'
import * as xe from '@edge/xe-utils'
import { Network } from '../main'
import { checkVersionHandler } from '../update/cli'
import config from '../config'
import { Command, Option } from 'commander'
import Docker, { DockerOptions } from 'dockerode'
import { errorHandler, getVerboseOption } from '../edge/cli'

// dummy value for testing docker interactions - replace with staking integration later
const imageName = 'registry.edge.network/library/nginx'

const registerAction = (parent: Command, registerCmd: Command, network: Network) => async () => {
  // const opts = {
  //   ...walletCLI.getWalletOption(parent, network)
  // }

  const docker = new Docker(getDockerOptions(registerCmd))
  const volume = await data.volume(docker)

  const deviceWallet = xe.wallet.create()
  data.write(docker, volume, { ...deviceWallet, network: network.name })

  console.log(`Device ID: ${deviceWallet.address}`)

  // WIP
  // const stakes = await xe.stake.stakes(network.blockchain.baseURL, deviceWallet.address)
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
    .argument('[id]', 'stake ID')
    .description('register this device on the network')
    .addOption(socketPathOption())
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
