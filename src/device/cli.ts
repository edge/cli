// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as data from './data'
import * as image from './image'
import * as stargate from '../stargate'
import { arch } from 'os'
import { checkVersionHandler } from '../update/cli'
import config from '../config'
import { getPassphraseOption } from '../wallet/cli'
import { Command, Option } from 'commander'
import { CommandContext, Context, Network } from '..'
import Dockerode, { AuthConfig, ContainerCreateOptions, DockerOptions } from 'dockerode'
import { ask, askLetter, getYesOption, yesOption } from '../input'
import { askToSignTx, handleCreateTxResult } from '../transaction'
import { canAssign, findOne, precedence as nodeTypePrecedence } from '../stake'
import { errorHandler, getDebugOption, getVerboseOption } from '../edge/cli'
import { printData, toUpperCaseFirst } from '../helpers'
import { stake as xeStake, tx as xeTx, wallet as xeWallet } from '@edge/xe-utils'

/**
 * Add a device to the network (`device add`).
 *
 * This initializes the device as necessary, including creating a device data volume.
 */
const addAction = ({ device, index, network, wallet, xe, ...ctx }: CommandContext) => async () => {
  const opts = {
    ...await getPassphraseOption(ctx.cmd),
    ...getStakeOption(ctx.cmd)
  }
  const { yes } = getYesOption(ctx.cmd)

  const { verbose } = getVerboseOption(ctx.parent)
  const printAddr = (id: string) => verbose ? id : id.slice(0, 9) + '...'
  const printID = (id: string) => verbose ? id : id.slice(0, config.id.shortLength)

  const userDevice = device()

  // get device data. if none, initialize device on the fly
  const deviceWallet = await (async () => {
    const volume = await userDevice.volume(true)
    let w: data.Device | undefined = undefined
    try {
      w = await volume.read()
    }
    catch (err) {
      console.log('Initializing device...')
      w = { ...xeWallet.create(), network: network.name }
      await volume.write(w)
      console.log()
    }
    return w as data.Device
  })()

  // get user stakes, check whether device already assigned
  const storage = wallet()
  const address = await storage.address()
  const { results: stakes } = await index().stakes(address, { limit: 999 })
  if (Object.keys(stakes).length === 0) throw new Error('no stakes')

  const assigned = Object.values(stakes).find(s => s.device === deviceWallet.address)
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
    numberedStakes.forEach((stake, n) => console.log([
      `${n+1}. ${printID(stake.id)} (${toUpperCaseFirst(stake.type)})`,
      stake.device ? ` (assigned to ${printAddr(stake.device)})` : ''
    ].join('')))
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

  if (!canAssign(stake)) {
    if (stake.released) throw new Error('this stake has been released')
    if (stake.unlockRequested) throw new Error('this stake is unlocked/unlocking and cannot be assigned')
    throw new Error('this stake cannot be assigned for an unknown reason')
  }

  // confirm user intent
  const nodeName = toUpperCaseFirst(stake.type)
  if (!yes) {
    console.log(`You are adding this device to Edge ${toUpperCaseFirst(network.name)}.`)
    console.log()
    console.log([
      `This device will be assigned to stake ${printID(stake.id)}, `,
      `allowing this device to operate a ${nodeName} node.`
    ].join(''))
    console.log()
    if (stake.device) {
      console.log([
        `This stake is already assigned to device ${printAddr(stake.device)} which will be removed from the network `,
        'if you assign this device in its place.'
      ].join(''))
      console.log()
    }
    if (await askLetter('Add this device?', 'yn') === 'n') return
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
      device: deviceWallet.address,
      memo: 'Assign Device',
      signature: xeWallet.generateSignature(deviceWallet.privateKey, deviceWallet.address),
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

/** Help text for the `device add` command. */
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

/**
 * Display device information (`device info`).
 */
const infoAction = ({ device, logger, wallet, xe, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const { debug } = getDebugOption(ctx.parent)
  const { verbose } = getVerboseOption(ctx.parent)
  const printID = (id: string) => verbose ? id: id.slice(0, config.id.shortLength)

  const userDevice = device()
  const deviceWallet = await (await userDevice.volume()).read()

  const toPrint: Record<string, string> = {
    Network: toUpperCaseFirst(deviceWallet.network),
    Device: deviceWallet.address
  }

  try {
    const address = await wallet().address()
    const stake = Object.values(await xe().stakes(address)).find(s => s.device === deviceWallet.address)
    if (stake !== undefined) {
      toPrint.Type = toUpperCaseFirst(stake.type)
      toPrint.Stake = printID(stake.id)
    }
    else toPrint.Stake = 'Unassigned'
  }
  catch (err) {
    if (debug) log.error(`${err}`, { err })
    toPrint.Stake = 'Unassigned (no wallet)'
  }

  console.log(printData(toPrint))
}

/** Help text for the `device info` command. */
const infoHelp = [
  '\n',
  'This command displays information about your device and the stake it is assigned to.'
].join('')

/**
 * Remove a device from the network (`device remove`).
 *
 * If the device is assigned to a stake, its assignment will be removed.
 * If the device is running, it will be stopped.
 * Afterwards, the data volume is removed, effectively 'destroying' the device.
 */
const removeAction = ({ device, logger, wallet, xe, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const opts = await getPassphraseOption(ctx.cmd)
  const { yes } = getYesOption(ctx.cmd)

  const { verbose } = getVerboseOption(ctx.parent)
  const printID = (id: string) => verbose ? id : id.slice(0, config.id.shortLength)

  const userDevice = device()
  const docker = userDevice.docker()
  const volume = await userDevice.volume()
  const deviceWallet = await volume.read()

  const storage = wallet()
  const address = await storage.address()
  const xeClient = xe()
  const stake = Object.values(await xeClient.stakes(address)).find(s => s.device === deviceWallet.address)
  const nodeName = stake !== undefined ? toUpperCaseFirst(stake.type) : ''

  // confirm user intent
  if (!yes) {
    console.log(`You are removing this device from Edge ${toUpperCaseFirst(ctx.network.name)}.`)
    console.log()
    if (stake === undefined) console.log('This device is not assigned to any stake.')
    else console.log(`This will remove this device's assignment to stake ${printID(stake.id)} (${nodeName}).`)
    console.log()
    if (await askLetter('Remove this device?', 'yn') === 'n') return
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
    if (!handleCreateTxResult(ctx.network, result)) {
      process.exitCode = 1
      return
    }
    console.log()

    // if node is running, stop it
    log.debug('finding node')
    const imageName = ctx.network.registry.imageName(stake.type, arch())
    const info = (await docker.listContainers()).find(c => c.Image === imageName)
    if (info !== undefined) {
      log.debug('found container', { name: toUpperCaseFirst(stake.type), id: info.Id })
      const container = docker.getContainer(info.Id)
      console.log(`Stopping ${nodeName}...`)
      await container.stop()
      await container.remove()
      console.log()
    }
  }

  await volume.remove()

  console.log(`This device has been removed from Edge ${toUpperCaseFirst(ctx.network.name)}.`)
}

/** Help text for the `device remove` command. */
const removeHelp = [
  '\n',
  'This command removes this device from the network.\n\n',
  'Removing a device will:\n',
  '  - Unassign it from its stake\n',
  '  - Stop the node (if it is running)\n',
  '  - Destroy the device\'s identity\n'
].join('')

/**
 * Restart a running device (`device restart`).
 *
 * If the device is not running, nothing happens.
 */
const restartAction = ({ device }: CommandContext) => async () => {
  const userDevice = device()
  const docker = userDevice.docker()
  const node = await userDevice.node()

  const info = await node.container()
  if (info === undefined) {
    console.log(`${node.name} is not running`)
    return
  }

  await docker.getContainer(info.Id).restart()
  console.log(`${node.name} restarted`)
}

/** Help text for the `device restart` command. */
const restartHelp = '\nRestart the node, if it is running.'

/**
 * Start a device (`device start`).
 *
 * If the device is already running, nothing happens.
 *
 * Before starting, we check whether an update is available and if so, download it first.
 */
const startAction = ({ device, logger, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const { env } = getNodeEnvOption(ctx.cmd)
  const { network } = getNodeNetworksOption(ctx.cmd)

  const userDevice = device()
  const docker = userDevice.docker()
  const node = await userDevice.node()

  let info = await node.container()
  if (info !== undefined) {
    console.log(`${node.name} is already running`)
    return
  }

  console.log(`Checking ${node.name} version...`)
  const { target } = await getTargetOption(ctx, ctx.cmd, node.stake.type)
  log.debug('got target version', { target })
  const targetImage = `${node.image}:${target}`

  console.log(`Updating ${node.name} v${target}...`)
  const authconfig = getRegistryAuthOptions(ctx.cmd)
  const { debug } = getDebugOption(ctx.parent)
  if (authconfig !== undefined) await image.pullVisible(docker, targetImage, authconfig, debug)
  else await image.pullVisible(docker, targetImage, authconfig, debug)

  const containerOptions = createContainerOptions(node, target, env, network)
  log.debug('creating container', { containerOptions })
  const container = await docker.createContainer(containerOptions)
  log.debug('starting container')
  await container.start()

  info = await node.container()
  if (info === undefined) throw new Error(`${node.name} failed to start`)
  console.log(`${node.name} started`)
}

/** Help text for the `device start` command. */
const startHelp = (network: Network) => [
  '\n',
  'Start the node. Your device must be added to the network first. ',
  `Run '${network.appName} device add --help' for more information.`
].join('')

/**
 * Display the device status (`device status`).
 *
 * This only reports whether the device is running or not.
 * For more information about the device, use `device info` instead.
 */
const statusAction = ({ device }: CommandContext) => async () => {
  const userDevice = device()
  const node = await userDevice.node()
  const info = await node.container()
  if (info === undefined) console.log(`${node.name} is not running`)
  else console.log(`${node.name} is running`)
}

/** Help text for the `device status` command. */
const statusHelp = '\nDisplay the status of the node (whether it is running or not).'

/**
 * Stop a device (`device stop`).
 *
 * If the device is already stopped, nothing happens.
 */
const stopAction = ({ device, logger }: CommandContext) => async () => {
  const log = logger()

  const userDevice = device()
  const docker = userDevice.docker()
  const node = await userDevice.node()

  const info = await node.container()
  if (info === undefined) {
    console.log(`${node.name} is not running`)
    return
  }

  const container = docker.getContainer(info.Id)
  log.debug('stopping container', { id: info.Id })
  await container.stop()
  log.debug('removing container', { id: info.Id })
  await container.remove()
  console.log(`${node.name} stopped`)
}

/** Help text for the `device stop` command. */
const stopHelp = '\nStop the node, if it is running.'

/**
 * Update a device (`device update`).
 *
 * If the device is running, it will be restarted after the update.
 */
const updateAction = ({ device, logger, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const userDevice = device()
  const docker = userDevice.docker()
  const node = await userDevice.node()

  console.log(`Checking ${node.name} version...`)
  const { target } = await getTargetOption(ctx, ctx.cmd, node.stake.type)
  log.debug('got target version', { target })
  const targetImage = `${node.image}:${target}`

  let info = await node.container()
  let container = info && docker.getContainer(info.Id)
  const containerInspect = await container?.inspect()

  let currentImage: Dockerode.ImageInspectInfo | undefined = undefined
  if (containerInspect !== undefined) {
    // get running container image to compare
    currentImage = await docker.getImage(containerInspect.Image).inspect()
  }
  else {
    try {
      // get existing image if pulled previously
      currentImage = await docker.getImage(targetImage).inspect()
    }
    catch (err) {
      log.debug('failed to locate current image', { err })
    }
  }
  if (currentImage !== undefined) log.debug('current image', { currentImage })

  console.log(`Updating ${node.name} v${target}...`)
  const { debug } = getDebugOption(ctx.parent)
  const authconfig = getRegistryAuthOptions(ctx.cmd)
  if (authconfig !== undefined) await image.pullVisible(docker, targetImage, authconfig, debug)
  else await image.pullVisible(docker, targetImage, authconfig, debug)

  const latestImage = await docker.getImage(targetImage).inspect()
  if (latestImage.Id === currentImage?.Id) {
    console.log(`${node.name} is up to date`)
    return
  }
  console.log(`${node.name} has been updated`)

  if (container === undefined) return

  // container is already running, need to stop-start
  console.log(`Restarting ${node.name}...`)
  log.debug('stopping container', { id: containerInspect?.Id })
  await container.stop()
  log.debug('removing container', { id: containerInspect?.Id })
  await container.remove()

  const containerOptions = createContainerOptions(node, target, containerInspect?.Config.Env)
  if (containerInspect && Object.keys(containerInspect.NetworkSettings.Networks).length > 0) {
    const endpoints: Dockerode.EndpointsConfig = {}
    Object.keys(containerInspect.NetworkSettings.Networks).forEach(n => {
      endpoints[n] = containerInspect.NetworkSettings.Networks[n]
    })
    containerOptions.NetworkingConfig = { EndpointsConfig: endpoints }
  }

  log.debug('creating container', { containerOptions })
  container = await docker.createContainer(containerOptions)
  log.debug('starting container')
  await container.start()

  info = await node.container()
  if (info === undefined) throw new Error(`${node.name} failed to restart`)
  console.log()
  console.log(`${node.name} restarted`)
}

/** Help text for the `device update` command. */
const updateHelp = '\nUpdate the node, if an update is available.'

type nodeInfo = {
  containerName: string
  image: string
  stake: xeStake.Stake
}

/**
 * Build a container options object for a new Docker container.
 */
const createContainerOptions = (
  node: nodeInfo,
  tag: string,
  env: string[] | undefined,
  networks?: string[]
): ContainerCreateOptions => {
  const containerName = `edge-${node.stake.type}-${Math.random().toString(16).substring(2, 8)}`
  const opts: ContainerCreateOptions = {
    Image: `${node.image}:${tag}`,
    name: containerName,
    AttachStdin: false,
    AttachStdout: false,
    AttachStderr: false,
    Env: env,
    Tty: false,
    OpenStdin: false,
    StdinOnce: false,
    HostConfig: {
      Binds: [
        '/var/run/docker.sock:/var/run/docker.sock',
        `${config.docker.dataVolume}:/data`
      ],
      RestartPolicy: { Name: 'unless-stopped' }
    }
  }
  if (node.stake.type === 'gateway' || node.stake.type === 'stargate') {
    if (!opts || !opts.HostConfig) opts.HostConfig = {}
    opts.HostConfig.PortBindings = {
      '80/tcp': [{ HostPort: '80' }],
      '443/tcp': [{ HostPort: '443' }]
    }
    opts.ExposedPorts = {
      '80/tcp': {},
      '443/tcp': {}
    }
  }
  if (networks?.length) {
    opts.NetworkingConfig = {
      EndpointsConfig: networks.reduce((e, n) => {
        e[n] = {}
        return e
      }, <Dockerode.EndpointsConfig>{})
    }
  }
  return opts
}

/**
 * Create a CLI option for the Docker socket path.
 */
export const dockerSocketPathOption = (description = 'Docker socket path'): Option =>
  new Option('--docker-socket-path <path>', description)

/**
 * Get Docker options from user command, including the socket path.
 */
export const getDockerOptions = (cmd: Command): DockerOptions => {
  const opts = cmd.opts<{
    dockerSocketPath?: string
  }>()

  if (opts.dockerSocketPath) return { socketPath: opts.dockerSocketPath }

  // return empty options and let docker-modem set default options for windows or linux
  return {}
}

/**
 * Get Docker ENV inputs from user command.
 */
const getNodeEnvOption = (cmd: Command): { env: string[] } => {
  const { env } = cmd.opts<{ env?: string[] }>()
  return {
    env: env !== undefined ? env : []
  }
}

/**
 * Get Docker networks from user command.
 * This allows the device to join user-defined networks rather than the default bridge.
 */
const getNodeNetworksOption = (cmd: Command): { network?: string[] } => {
  const { network } = cmd.opts<{ network?: string[] }>()
  return { network }
}

/**
 * Get Edge Registry authentication options from user command or environment.
 */
const getRegistryAuthOptions = (cmd: Command): AuthConfig|undefined => {
  const opts = cmd.opts<{
    registryUsername?: string
    registryPassword?: string
  }>()
  if (opts.registryUsername || config.docker.edgeRegistry.auth.username) {
    return {
      serveraddress: config.docker.edgeRegistry.address,
      username: opts.registryUsername || config.docker.edgeRegistry.auth.username,
      password: opts.registryPassword || config.docker.edgeRegistry.auth.password
    }
  }
  return undefined
}

/**
 * Get stake hash from user command.
 */
const getStakeOption = (cmd: Command) => {
  const { stake } = cmd.opts<{ stake?: string }>()
  return { stake }
}

/**
 * Get target version option from user command.
 * This allows a particular version of the device software to be specified for use.
 */
const getTargetOption = async ({ network }: Pick<Context, 'network'>, cmd: Command, name: string) => {
  const { target } = cmd.opts<{ target?: string }>()
  return {
    target: target || await stargate.getServiceVersion(network, name)
  }
}

/** Create ENV option for CLI. */
const nodeEnvOption = (description = 'set environment variable(s) for node') =>
  new Option('-e, --env <var...>', description)

/** Create Docker network option for CLI. */
const nodeNetworkOption = (description = 'set network(s) for node') => new Option('--network <var...>', description)

/** Create Docker registry password option for CLI. */
const registryPasswordOption = (description = 'Edge Docker registry password') =>
  new Option('--registry-password <password>', description)

/** Create Docker username option for CLI. */
const registryUsernameOption = (description = 'Edge Docker registry username') =>
  new Option('--registry-username <username>', description)

/** Create stake option for CLI. */
const stakeOption = (description = 'stake ID') => new Option('-s, --stake <id>', description)

/** Create target version option for CLI. */
const targetOption = (description = 'node target version') =>
  new Option('--target <version>', description)

/**
 * Configure `device` commands with root context.
 */
export const withContext = (ctx: Context): [Command, Option[]] => {
  const deviceCLI = new Command('device')
    .description('manage device')

  // edge device add
  const add = new Command('add')
    .description('add this device to the network')
    .addHelpText('after', addHelp(ctx.network))
    .addOption(stakeOption())
    .addOption(yesOption())
  add.action(errorHandler(ctx, checkVersionHandler(ctx, addAction({ ...ctx, cmd: add }))))

  // edge device info
  const info = new Command('info')
    .description('display device/stake information')
    .addHelpText('after', infoHelp)
  info.action(errorHandler(ctx, checkVersionHandler(ctx, infoAction({ ...ctx, cmd: info }))))

  // edge device remove
  const remove = new Command('remove')
    .description('remove this device from the network')
    .addHelpText('after', removeHelp)
    .addOption(yesOption())
  remove.action(errorHandler(ctx, checkVersionHandler(ctx, removeAction({ ...ctx, cmd: remove }))))

  // edge device restart
  const restart = new Command('restart')
    .description('restart node')
    .addHelpText('after', restartHelp)
  restart.action(errorHandler(ctx, checkVersionHandler(ctx, restartAction({ ...ctx, cmd: restart }))))

  // edge device start
  const start = new Command('start')
    .description('start node')
    .addHelpText('after', startHelp(ctx.network))
    .addOption(targetOption())
    .addOption(nodeEnvOption())
    .addOption(nodeNetworkOption())
    .addOption(registryUsernameOption())
    .addOption(registryPasswordOption())
  start.action(errorHandler(ctx, checkVersionHandler(ctx, startAction({ ...ctx, cmd: start }))))

  // edge device status
  const status = new Command('status')
    .description('display node status')
    .addHelpText('after', statusHelp)
  status.action(errorHandler(ctx, checkVersionHandler(ctx, statusAction({ ...ctx, cmd: status }))))

  // edge device stop
  const stop = new Command('stop')
    .description('stop node')
    .addHelpText('after', stopHelp)
  stop.action(errorHandler(ctx, checkVersionHandler(ctx, stopAction({ ...ctx, cmd: stop }))))

  // edge device update
  const update = new Command('update')
    .description('update node')
    .addHelpText('after', updateHelp)
    .addOption(targetOption())
    .addOption(registryUsernameOption())
    .addOption(registryPasswordOption())
  update.action(errorHandler(ctx, checkVersionHandler(ctx, updateAction({ ...ctx, cmd: update }))))

  deviceCLI
    .addCommand(add)
    .addCommand(info)
    .addCommand(remove)
    .addCommand(restart)
    .addCommand(start)
    .addCommand(status)
    .addCommand(stop)
    .addCommand(update)

  return [deviceCLI, [dockerSocketPathOption()]]
}
