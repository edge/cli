// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as image from '../image'
import * as repl from '../../repl'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import { createContainerOptions } from '.'
import { errorHandler } from '../../cli'
import { Context, Network } from '../../main'

/**
 * Start a device.
 *
 * If the device is already running, nothing happens.
 *
 * Before starting, we check whether an update is available and if so, download it first.
 */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.docker.readEnv(ctx.cmd),
    ...cli.docker.readNetworks(ctx.cmd),
    ...cli.docker.readPrefix(ctx.cmd)
  }

  const log = ctx.log()
  const device = ctx.device(opts.prefix)
  const docker = device.docker()
  const node = await device.node()

  let info = await node.container()
  if (info !== undefined) {
    repl.echo(`${node.name} is already running`)
    return
  }

  repl.echo(`Checking ${node.name} version...`)
  const { target } = await cli.docker.readTarget(ctx, node.stake.type)
  log.debug('got target version', { target })
  const targetImage = `${node.image}:${target}`

  repl.echo(`Updating ${node.name} v${target}...`)
  const authconfig = cli.docker.readAuth(ctx.cmd)
  const { debug } = cli.debug.read(ctx.parent)
  if (authconfig !== undefined) await image.pullVisible(docker, targetImage, authconfig, debug)
  else await image.pullVisible(docker, targetImage, authconfig, debug)

  const containerOptions = createContainerOptions(node, target, opts.env, opts.prefix, opts.network)
  log.debug('creating container', { containerOptions })
  const container = await docker.createContainer(containerOptions)
  log.debug('starting container')
  await container.start()

  info = await node.container()
  if (info === undefined) throw new Error(`${node.name} failed to start`)
  repl.echo(`${node.name} started`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('start').description('start node').addHelpText('after', help(ctx.network))
  cli.docker.configureAuth(cmd)
  cli.docker.configureEnv(cmd)
  cli.docker.configureNetworks(cmd)
  cli.docker.configurePrefix(cmd)
  cli.docker.configureTarget(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

/* eslint-disable max-len */
const help = (network: Network) => `
Start the node. Your device must be added to the network first. Run '${network.appName} device add --help' for more information.
`
/* eslint-enable max-len */
