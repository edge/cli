// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as data from './data'
import * as node from './node'
import * as walletCLI from '../wallet/cli'
import * as xe from '@edge/xe-utils'
import { Network } from '../main'
import { ask } from '../input'
import { checkVersionHandler } from '../update/cli'
import config from '../config'
import { withFile } from '../wallet/storage'
import { withNetwork as xeWithNetwork } from '../transaction/xe'
import { Command, Option } from 'commander'
import Docker, { DockerOptions } from 'dockerode'
import { askToSignTx, handleCreateTxResult } from '../transaction'
import { errorHandler, getVerboseOption } from '../edge/cli'
import { findOne, precedence as nodeTypePrecedence } from '../stake'
import { printData, printTrunc, toUpperCaseFirst } from '../helpers'

const addAction = (parent: Command, addCmd: Command, network: Network) => async () => {
  const opts = {
    ...walletCLI.getWalletOption(parent, network),
    ...walletCLI.getPassphraseOption(addCmd),
    ...(() => {
      const { fullIds, stake, yes } = addCmd.opts<{
        fullIds: boolean
        stake: string | undefined
        yes: boolean
      }>()
      return { fullIds, stake, yes }
    })()
  }
  const printID = printTrunc(!opts.fullIds, 8)

  const storage = withFile(opts.wallet)
  const docker = new Docker(getDockerOptions(addCmd))

  // get device data. if none, initialize device on the fly
  const dataVolume = data.withVolume(docker, await data.volume(docker, true))
  const device = await (async () => {
    let w: data.Device | undefined = undefined
    try {
      w = await dataVolume.read()
    }
    catch (err) {
      console.log('Initializing device...')
      w = { ...xe.wallet.create(), network: network.name }
      await dataVolume.write(w)
      console.log()
    }
    return w as data.Device
  })()

  // get user stakes, check whether device already assigned
  const stakes = await xe.stake.stakes(network.blockchain.baseURL, await storage.address())
  if (Object.keys(stakes).length === 0) throw new Error('no stakes')
  const assigned = Object.values(stakes).find(s => s.device === device.address)
  if (assigned !== undefined) {
    console.log([
      `This device is already assigned to stake ${printID(assigned.id)} `,
      `(${toUpperCaseFirst(assigned.type)}) on Edge ${toUpperCaseFirst(network.name)}.`
    ].join(''))
    console.log()
    console.log([
      `To reassign this device, run '${network.appName} device remove' first to remove it from the network, `,
      `then run '${network.appName} device add' again to add it back.`
    ].join(''))
    process.exitCode = 1
    return
  }

  // identify stake to assign device to
  const stake = await (async () => {
    if (opts.stake !== undefined) return findOne(stakes, opts.stake)

    console.log('Select a stake to assign this device to:')
    console.log()
    const numberedStakes = Object.values(stakes)
      .sort((a, b) => {
        const posDiff = nodeTypePrecedence[a.type] - nodeTypePrecedence[b.type]
        return posDiff !== 0 ? posDiff : a.created - b.created
      })
    numberedStakes.forEach((stake, n) => console.log(
      `${n+1}. ${printID(stake.id)} (${toUpperCaseFirst(stake.type)})`
    ))
    console.log()
    let sel = 0
    while (sel === 0) {
      const selstr = await ask(`Enter a number: (1-${numberedStakes.length}) `)
      const tmpsel = parseInt(selstr)
      if (tmpsel > 0 && tmpsel <= numberedStakes.length) sel = tmpsel
      else console.log(`Please enter a number between 1 and ${numberedStakes.length}.`)
    }
    console.log()
    return numberedStakes[sel-1]
  })()

  // confirm user intent
  const nodeName = toUpperCaseFirst(stake.type)
  if (!opts.yes) {
    console.log(`You are adding this device to Edge ${toUpperCaseFirst(network.name)}.`)
    console.log()
    console.log([
      `This device will be assigned to stake ${printID(stake.id)}, `,
      `allowing this device to operate a ${nodeName} node.`
    ].join(''))
    console.log()
    let confirm = ''
    const ynRegexp = /^[yn]$/
    while (confirm.length === 0) {
      const input = await ask('Add this device? [yn] ')
      if (ynRegexp.test(input)) confirm = input
      else console.log('Please enter y or n.')
    }
    if (confirm === 'n') return
    console.log()
  }

  // create assignment tx
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

  // next steps advice
  console.log()
  console.log([
    `You may run '${network.appName} tx lsp' to check progress of your pending transaction. `,
    'When your stake transaction has been processed it will no longer be listed as pending.'
  ].join(''))
  console.log()
  console.log(`You can then run '${network.appName} device start' to start a ${nodeName} node on this device.`)
}

const infoAction = (parent: Command, infoCmd: Command, network: Network) => async () => {
  const opts = {
    ...getVerboseOption(parent),
    ...walletCLI.getWalletOption(parent, network),
    ...(() => {
      const { fullIds } = infoCmd.opts<{ fullIds: boolean }>()
      return { fullIds }
    })()
  }
  const printID = printTrunc(!opts.fullIds, 8)

  const docker = new Docker(getDockerOptions(infoCmd))
  const dataVolume = data.withVolume(docker, await data.volume(docker))
  const device = await dataVolume.read()

  const toPrint: Record<string, string> = {
    Network: toUpperCaseFirst(device.network),
    Device: device.address
  }

  try {
    const address = await withFile(opts.wallet).address()
    const stakes = await xe.stake.stakes(network.blockchain.baseURL, address)
    const stake = Object.values(stakes).find(s => s.device === device.address)
    if (stake !== undefined) {
      toPrint.Type = toUpperCaseFirst(stake.type)
      toPrint.Stake = printID(stake.id)
    }
    else toPrint.Stake = 'Unassigned'
  }
  catch (err) {
    toPrint.Stake = 'Unassigned (no wallet)'
  }

  console.log(printData(toPrint))
}

const removeAction = (parent: Command, removeCmd: Command, network: Network) => async () => {
  const opts = {
    ...walletCLI.getWalletOption(parent, network),
    ...walletCLI.getPassphraseOption(removeCmd),
    ...(() => {
      const { fullIds, yes } = removeCmd.opts<{ fullIds: boolean, yes: boolean }>()
      return { fullIds, yes }
    })()
  }
  const printID = printTrunc(!opts.fullIds, 8)

  const storage = withFile(opts.wallet)
  const docker = new Docker(getDockerOptions(removeCmd))

  const dataVolume = data.withVolume(docker, await data.volume(docker))
  const device = await dataVolume.read()

  const stakes = await xe.stake.stakes(network.blockchain.baseURL, await storage.address())
  const stake = Object.values(stakes).find(s => s.device === device.address)
  const nodeName = stake !== undefined ? toUpperCaseFirst(stake.type) : ''

  // confirm user intent
  if (!opts.yes) {
    console.log(`You are removing this device from Edge ${toUpperCaseFirst(network.name)}.`)
    console.log()
    if (stake === undefined) console.log('This device is not assigned to any stake.')
    else console.log(`This will remove this device's assignment to stake ${printID(stake.id)} (${nodeName}).`)
    console.log()
    let confirm = ''
    const ynRegexp = /^[yn]$/
    while (confirm.length === 0) {
      const input = await ask('Remove this device? [yn] ')
      if (ynRegexp.test(input)) confirm = input
      else console.log('Please enter y or n.')
    }
    if (confirm === 'n') return
    console.log()
  }

  if (stake !== undefined) {
    // if required, create unassignment tx
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
    console.log()
    const result = await api.createTransaction(tx)
    if (!handleCreateTxResult(network, result)) {
      process.exitCode = 1
      return
    }
    console.log()

    // if node is running, stop it
    const imageName = network.registry.imageName(stake.type)
    const info = (await docker.listContainers()).find(c => c.Image === imageName)
    if (info !== undefined) {
      const container = docker.getContainer(info.Id)
      console.log(`Stopping ${nodeName}...`)
      await container.stop()
      await container.remove()
      console.log()
    }
  }

  console.log('Removing device...')
  await dataVolume.remove()
  console.log()

  console.log(`This device has been removed from Edge ${toUpperCaseFirst(network.name)}.`)
}

const restartAction = (parent: Command, restartCmd: Command, network: Network) => async () => {
  const opts = {
    ...getVerboseOption(parent),
    ...walletCLI.getWalletOption(parent, network)
  }
  const docker = new Docker(getDockerOptions(restartCmd))
  const nodeInfo = await node.withAddress(docker, network, await withFile(opts.wallet).address())

  const info = await nodeInfo.container()
  if (info === undefined) {
    console.log(`${nodeInfo.name} is not running`)
    return
  }

  await docker.getContainer(info.Id).restart()
  console.log(`${nodeInfo.name} restarted`)
}

const startAction = (parent: Command, startCmd: Command, network: Network) => async () => {
  const opts = {
    ...getVerboseOption(parent),
    ...walletCLI.getWalletOption(parent, network)
  }
  const docker = new Docker(getDockerOptions(startCmd))
  const nodeInfo = await node.withAddress(docker, network, await withFile(opts.wallet).address())

  let info = await nodeInfo.container()
  if (info !== undefined) {
    console.log(`${nodeInfo.name} is already running`)
    return
  }

  const container = await docker.createContainer({
    Image: nodeInfo.image,
    AttachStdin: false,
    AttachStdout: false,
    AttachStderr: false,
    Tty: false,
    OpenStdin: false,
    StdinOnce: false,
    HostConfig: {
      Binds: [`${nodeInfo.dataVolume.Name}:/device`],
      RestartPolicy: { Name: 'unless-stopped' }
    }
  })
  await container.start()

  info = await nodeInfo.container()
  if (info === undefined) throw new Error(`${nodeInfo.name} failed to start`)
  console.log(`${nodeInfo.name} started`)
}

const statusAction = (parent: Command, statusCmd: Command, network: Network) => async () => {
  const opts = {
    ...getVerboseOption(parent),
    ...walletCLI.getWalletOption(parent, network)
  }
  const docker = new Docker(getDockerOptions(statusCmd))
  const nodeInfo = await node.withAddress(docker, network, await withFile(opts.wallet).address())

  const info = await nodeInfo.container()
  if (info === undefined) console.log(`${nodeInfo.name} is not running`)
  else console.log(`${nodeInfo.name} is running`)
}

const stopAction = (parent: Command, stopCmd: Command, network: Network) => async () => {
  const opts = {
    ...getVerboseOption(parent),
    ...walletCLI.getWalletOption(parent, network)
  }
  const docker = new Docker(getDockerOptions(stopCmd))
  const nodeInfo = await node.withAddress(docker, network, await withFile(opts.wallet).address())

  const info = await nodeInfo.container()
  if (info === undefined) {
    console.log(`${nodeInfo.name} is not running`)
    return
  }

  const container = docker.getContainer(info.Id)
  await container.stop()
  await container.remove()
  console.log(`${nodeInfo.name} stopped`)
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
    .description('add this device to the network')
    .addOption(socketPathOption())
    .option('-D, --full-ids', 'display full-length IDs')
    .option('-s, --stake', 'stake ID')
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

  // edge device info
  const info = new Command('info')
    .description('display device/stake information')
    .addOption(socketPathOption())
    .option('-D, --full-ids', 'display full-length IDs')
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

  // edge device remove
  const remove = new Command('remove')
    .description('remove this device from the network')
    .addOption(socketPathOption())
    .option('-D, --full-ids', 'display full-length IDs')
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
    .description('restart nodes')
    .addOption(socketPathOption())
  restart.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        restartAction(parent, restart, network)
      )
    )
  )

  // edge device start
  const start = new Command('start')
    .description('start nodes')
    .addOption(socketPathOption())
  start.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        startAction(parent, start, network)
      )
    )
  )

  // edge device status
  const status = new Command('status')
    .description('display nodes status')
    .addOption(socketPathOption())
  status.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        statusAction(parent, status, network)
      )
    )
  )

  // edge device stop
  const stop = new Command('stop')
    .description('stop nodes')
    .addOption(socketPathOption())
  stop.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        stopAction(parent, stop, network)
      )
    )
  )

  deviceCLI
    .addCommand(add)
    .addCommand(info)
    .addCommand(remove)
    .addCommand(restart)
    .addCommand(start)
    .addCommand(status)
    .addCommand(stop)

  parent.addCommand(deviceCLI)
}
