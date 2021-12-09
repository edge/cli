// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as data from './data'
import * as node from './node'
import { ask } from '../input'
import { checkVersionHandler } from '../update/cli'
import config from '../config'
import { getPassphraseOption } from '../wallet/cli'
import { Command, Option } from 'commander'
import { CommandContext, Context, Network } from '..'
import Docker, { DockerOptions } from 'dockerode'
import { askToSignTx, handleCreateTxResult } from '../transaction'
import { canAssign, findOne, precedence as nodeTypePrecedence } from '../stake'
import { errorHandler, getDebugOption, getVerboseOption } from '../edge/cli'
import { printData, printTrunc, toUpperCaseFirst } from '../helpers'
import { tx as xeTx, wallet as xeWallet } from '@edge/xe-utils'

const addAction = ({ index, logger, network, wallet, xe, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const opts = {
    ...getVerboseOption(ctx.parent),
    ...await getPassphraseOption(ctx.cmd),
    ...(() => {
      const { stake, yes } = ctx.cmd.opts<{
        stake: string | undefined
        yes: boolean
      }>()
      return { stake, yes }
    })(),
    docker: getDockerOptions(ctx.cmd)
  }
  log.debug('options', opts)

  const printID = printTrunc(!opts.verbose, 8)

  log.debug('Connecting to Docker', { ...opts.docker })
  const docker = new Docker(opts.docker)

  // get device data. if none, initialize device on the fly
  log.debug('Finding/creating device data')
  const dataVolume = data.withVolume(docker, await data.volume(docker, true))
  const device = await (async () => {
    let w: data.Device | undefined = undefined
    try {
      w = await dataVolume.read()
    }
    catch (err) {
      console.log('Initializing device...')
      w = { ...xeWallet.create(), network: network.name }
      await dataVolume.write(w)
      console.log()
    }
    return w as data.Device
  })()
  log.debug('Device data', { device })

  // get user stakes, check whether device already assigned
  const storage = wallet()
  const address = await storage.address()
  const { results: stakes } = await index().stakes(address, { limit: 999 })
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
      .filter(canAssign)
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
  log.debug('Using stake', { stake })

  if (!canAssign(stake)) {
    if (stake.released) throw new Error('this stake has been released')
    if (stake.unlockRequested) throw new Error('this stake is unlocked/unlocking and cannot be assigned')
    if (stake.device) throw new Error('this stake is already assigned')
  }

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
  const userWallet = await storage.read(opts.passphrase as string)

  const xeClient = xe()
  const onChainWallet = await xeClient.walletWithNextNonce(userWallet.address)

  const tx = xeTx.sign({
    timestamp: Date.now(),
    sender: userWallet.address,
    recipient: userWallet.address,
    amount: 0,
    data: {
      action: 'assign_device',
      device: device.address,
      memo: 'Assign Device',
      stake: stake.hash
    },
    nonce: onChainWallet.nonce
  }, userWallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(network, result)) {
    process.exitCode = 1
    return
  }

  // next steps advice
  console.log()
  console.log([
    `You may run '${network.appName} tx lsp' to check progress of your pending transaction. `,
    'When your stake transaction has been processed it will no longer be listed as pending.'
  ].join(''))
  console.log()
  console.log(`You can then run '${network.appName} device start' to start a ${nodeName} node on this device.`)
}

const addHelp = (network: Network) => [
  '\n',
  'This command will add this device to the network, allowing it to operate as a node.\n\n',
  'Adding a device will:\n',
  '  - Initialize its identity if needed\n',
  '  - Assign it to a stake\n\n',
  'Stake assignment requires a blockchain transaction. After the transaction has been processed, this device can ',
  'run a node corresponding to the stake type.\n\n',
  'Before you run this command, ensure Docker is running and that you have an unassigned stake to assign this ',
  'device to.\n\n',
  `If you do not already have a stake, you can run '${network.appName} stake create' to get one.`
].join('')

const infoAction = ({ logger, wallet, xe, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const opts = {
    ...getDebugOption(ctx.parent),
    ...getVerboseOption(ctx.parent),
    docker: getDockerOptions(ctx.cmd)
  }
  log.debug('options', opts)

  const printID = printTrunc(!opts.verbose, 8)

  log.debug('Connecting to Docker', { ...opts.docker })
  const docker = new Docker(opts.docker)
  log.debug('Finding device data')
  const dataVolume = data.withVolume(docker, await data.volume(docker))
  const device = await dataVolume.read()
  log.debug('Device data', { device })

  const toPrint: Record<string, string> = {
    Network: toUpperCaseFirst(device.network),
    Device: device.address
  }

  try {
    const address = await wallet().address()
    const stake = Object.values(await xe().stakes(address)).find(s => s.device === device.address)
    if (stake !== undefined) {
      toPrint.Type = toUpperCaseFirst(stake.type)
      toPrint.Stake = printID(stake.id)
    }
    else toPrint.Stake = 'Unassigned'
  }
  catch (err) {
    if (opts.debug) log.error(`${err}`, { err })
    toPrint.Stake = 'Unassigned (no wallet)'
  }

  console.log(printData(toPrint))
}

const infoHelp = [
  '\n',
  'This command displays information about your device and the stake it is assigned to.'
].join('')

const removeAction = ({ logger, wallet, xe, ...ctx }: CommandContext) => async () => {
  const { parent, cmd, network } = ctx
  const log = logger()

  const opts = {
    ...getVerboseOption(parent),
    ...await getPassphraseOption(cmd),
    ...(() => {
      const { yes } = cmd.opts<{ yes: boolean }>()
      return { yes }
    })(),
    docker: getDockerOptions(cmd)
  }
  log.debug('options', opts)

  const printID = printTrunc(!opts.verbose, 8)

  log.debug('Connecting to Docker', { ...opts.docker })
  const docker = new Docker(opts.docker)

  log.debug('Finding device data')
  const dataVolume = data.withVolume(docker, await data.volume(docker))
  const device = await dataVolume.read()

  const storage = wallet()
  const address = await storage.address()

  const xeClient = xe()
  const stake = Object.values(await xeClient.stakes(address)).find(s => s.device === device.address)
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
    const userWallet = await storage.read(opts.passphrase as string)
    const onChainWallet = await xeClient.walletWithNextNonce(userWallet.address)

    const tx = xeTx.sign({
      timestamp: Date.now(),
      sender: userWallet.address,
      recipient: userWallet.address,
      amount: 0,
      data: {
        action: 'unassign_device',
        memo: 'Unassign Device',
        stake: stake.hash
      },
      nonce: onChainWallet.nonce
    }, userWallet.privateKey)

    console.log('Unassigning stake...')
    console.log()
    const result = await xeClient.createTransaction(tx)
    if (!handleCreateTxResult(network, result)) {
      process.exitCode = 1
      return
    }
    console.log()

    // if node is running, stop it
    log.debug('Finding node')
    const imageName = network.registry.imageName(stake.type)
    const info = (await docker.listContainers()).find(c => c.Image === imageName)
    if (info !== undefined) {
      log.debug('Found node', { name: toUpperCaseFirst(stake.type), id: info.Id })
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

const removeHelp = [
  '\n',
  'This command removes this device from the network.\n\n',
  'Removing a device will:\n',
  '  - Unassign it from its stake\n',
  '  - Stop the node (if it is running)\n',
  '  - Destroy the device\'s identity\n'
].join('')

const restartAction = ({ logger, wallet, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const opts = {
    ...getVerboseOption(ctx.parent),
    docker: getDockerOptions(ctx.cmd)
  }
  log.debug('options', opts)

  log.debug('Connecting to Docker', { ...opts.docker })
  const docker = new Docker(opts.docker)
  log.debug('Finding node')
  const nodeInfo = await node.withAddress(docker, ctx.network, await wallet().address())

  const info = await nodeInfo.container()
  if (info === undefined) {
    console.log(`${nodeInfo.name} is not running`)
    return
  }
  log.debug('Found node', { name: nodeInfo.name, id: info.Id })

  log.debug('Restarting node')
  await docker.getContainer(info.Id).restart()
  console.log(`${nodeInfo.name} restarted`)
}

const restartHelp = '\nRestart the node, if it is running.'

const startAction = ({ logger, wallet, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const opts = {
    ...getVerboseOption(ctx.parent),
    docker: getDockerOptions(ctx.cmd)
  }
  log.debug('options', opts)

  log.debug('Connecting to Docker', { ...opts.docker })
  const docker = new Docker(opts.docker)
  log.debug('Finding node')
  const nodeInfo = await node.withAddress(docker, ctx.network, await wallet().address())

  let info = await nodeInfo.container()
  if (info !== undefined) {
    log.debug('Found node', { name: nodeInfo.name, id: info.Id })
    console.log(`${nodeInfo.name} is already running`)
    return
  }

  log.debug('Creating node')
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
  log.debug('Starting node')
  await container.start()

  log.debug('Finding node')
  info = await nodeInfo.container()
  if (info === undefined) throw new Error(`${nodeInfo.name} failed to start`)
  log.debug('Found node', { name: nodeInfo.name, id: info.Id })
  console.log(`${nodeInfo.name} started`)
}

const startHelp = (network: Network) => [
  '\n',
  'Start the node. Your device must be added to the network first. ',
  `Run '${network.appName} device add --help' for more information.`
].join('')

const statusAction = ({ logger, wallet, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const opts = {
    ...getVerboseOption(ctx.parent),
    docker: getDockerOptions(ctx.cmd)
  }
  log.debug('options', opts)

  log.debug('Connecting to Docker', { ...opts.docker })
  const docker = new Docker(opts.docker)
  log.debug('Finding node')
  const nodeInfo = await node.withAddress(docker, ctx.network, await wallet().address())

  const info = await nodeInfo.container()
  if (info === undefined) console.log(`${nodeInfo.name} is not running`)
  else console.log(`${nodeInfo.name} is running`)
}

const statusHelp = '\nDisplay the status of the node (whether it is running or not).'

const stopAction = ({ logger, wallet, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const opts = {
    ...getVerboseOption(ctx.parent),
    docker: getDockerOptions(ctx.cmd)
  }
  log.debug('options', opts)

  log.debug('Connecting to Docker', { ...opts.docker })
  const docker = new Docker(opts.docker)
  log.debug('Finding node')
  const nodeInfo = await node.withAddress(docker, ctx.network, await wallet().address())

  const info = await nodeInfo.container()
  if (info === undefined) {
    console.log(`${nodeInfo.name} is not running`)
    return
  }
  log.debug('Found node', { name: nodeInfo.name, id: info.Id })

  const container = docker.getContainer(info.Id)
  log.debug('Stopping node')
  await container.stop()
  log.debug('Removing node')
  await container.remove()
  console.log(`${nodeInfo.name} stopped`)
}

const stopHelp = '\nStop the node, if it is running.'

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

export const withContext = (ctx: Context): Command => {
  const deviceCLI = new Command('device')
    .description('manage device')

  // edge device add
  const add = new Command('add')
    .description('add this device to the network')
    .addHelpText('after', addHelp(ctx.network))
    .addOption(socketPathOption())
    .option('-s, --stake <id>', 'stake ID')
    .option('-y, --yes', 'do not ask for confirmation')
  add.action(errorHandler(ctx, checkVersionHandler(ctx, addAction({ ...ctx, cmd: add }))))

  // edge device info
  const info = new Command('info')
    .description('display device/stake information')
    .addHelpText('after', infoHelp)
    .addOption(socketPathOption())
  info.action(errorHandler(ctx, checkVersionHandler(ctx, infoAction({ ...ctx, cmd: info }))))

  // edge device remove
  const remove = new Command('remove')
    .description('remove this device from the network')
    .addHelpText('after', removeHelp)
    .addOption(socketPathOption())
    .option('-y, --yes', 'do not ask for confirmation')
  remove.action(errorHandler(ctx, checkVersionHandler(ctx, removeAction({ ...ctx, cmd: remove }))))

  // edge device restart
  const restart = new Command('restart')
    .description('restart node')
    .addHelpText('after', restartHelp)
    .addOption(socketPathOption())
  restart.action(errorHandler(ctx, checkVersionHandler(ctx, restartAction({ ...ctx, cmd: restart }))))

  // edge device start
  const start = new Command('start')
    .description('start node')
    .addHelpText('after', startHelp(ctx.network))
    .addOption(socketPathOption())
  start.action(errorHandler(ctx, checkVersionHandler(ctx, startAction({ ...ctx, cmd: start }))))

  // edge device status
  const status = new Command('status')
    .description('display node status')
    .addHelpText('after', statusHelp)
    .addOption(socketPathOption())
  status.action(errorHandler(ctx, checkVersionHandler(ctx, statusAction({ ...ctx, cmd: status }))))

  // edge device stop
  const stop = new Command('stop')
    .description('stop node')
    .addHelpText('after', stopHelp)
    .addOption(socketPathOption())
  stop.action(errorHandler(ctx, checkVersionHandler(ctx, stopAction({ ...ctx, cmd: stop }))))

  deviceCLI
    .addCommand(add)
    .addCommand(info)
    .addCommand(remove)
    .addCommand(restart)
    .addCommand(start)
    .addCommand(status)
    .addCommand(stop)

  return deviceCLI
}
