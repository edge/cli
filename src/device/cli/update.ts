// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as image from '../image'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import { createContainerOptions } from '.'
import { errorHandler } from '../../cli'
import { CommandContext, Context } from '../..'
import { EndpointsConfig, ImageInspectInfo } from 'dockerode'

/**
 * Update a device.
 *
 * If the device is running, it will be restarted after the update.
 */
export const action = (ctx: CommandContext) => async (): Promise<void> => {
  const opts = {
    ...cli.docker.readPrefix(ctx.cmd)
  }

  const log = ctx.log()
  const device = ctx.device(opts.prefix)
  const docker = device.docker()
  const node = await device.node()

  console.log(`Checking ${node.name} version...`)
  const { target } = await cli.docker.readTarget(ctx, node.stake.type)
  log.debug('got target version', { target })
  const targetImage = `${node.image}:${target}`

  let info = await node.container()
  let container = info && docker.getContainer(info.Id)
  const containerInspect = await container?.inspect()

  let currentImage: ImageInspectInfo | undefined = undefined
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
  const { debug } = cli.debug.read(ctx.parent)
  const authconfig = cli.docker.readAuth(ctx.cmd)
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
    const endpoints: EndpointsConfig = {}
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

export const command = (ctx: Context): Command => {
  const cmd = new Command('update').description('update node').addHelpText('after', help)
  cli.docker.configureTarget(cmd)
  cli.docker.configurePrefix(cmd)
  cli.docker.configureAuth(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = `
Update the node, if an update is available.
`
