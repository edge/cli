// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as xeUtils from '@edge/xe-utils'
import { Command } from 'commander'
import { Context } from '../../main'
import { command as add } from './add'
import config from '../../config'
import { command as env } from './env'
import { command as info } from './info'
import { command as remove } from './remove'
import { command as restart } from './restart'
import { command as start } from './start'
import { command as status } from './status'
import { command as stop } from './stop'
import { command as update } from './update'
import { ContainerCreateOptions, EndpointsConfig } from 'dockerode'

type NodeInfo = {
  containerName: string
  image: string
  stake: xeUtils.stake.Stake
}

/**
 * Build a container options object for a new Docker container.
 */
export const createContainerOptions = (
  node: NodeInfo,
  tag: string,
  env: string[] | undefined,
  prefix?: string | undefined,
  networks?: string[]
): ContainerCreateOptions => {
  const containerName = [
    'edge',
    node.stake.type,
    prefix,
    Math.random().toString(16).substring(2, 8)
  ].filter(Boolean).join('-')

  let volumeName = config.docker.dataVolume
  if (prefix) volumeName = `${volumeName}-${prefix}`

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
        `${volumeName}:/data`
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
      }, <EndpointsConfig>{})
    }
  }
  return opts
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('device').description('manage device')
  cmd.addCommand(add(ctx))
  cmd.addCommand(env(ctx))
  cmd.addCommand(info(ctx))
  cmd.addCommand(remove(ctx))
  cmd.addCommand(restart(ctx))
  cmd.addCommand(start(ctx))
  cmd.addCommand(status(ctx))
  cmd.addCommand(stop(ctx))
  cmd.addCommand(update(ctx))
  return cmd
}
