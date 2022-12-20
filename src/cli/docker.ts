// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as sg from '@edge/stargate-utils'
import { Command } from 'commander'
import { CommandContext } from '..'
import config from '../config'
import { AuthConfig, DockerOptions } from 'dockerode'

/** Docker environment options. */
export type EnvOption = {
  /** Env variables to pass to a Docker container. */
  env: string[]
}

/** Docker networking options. */
export type NetworksOption = {
  /** Docker networks for a container to join. */
  network?: string[]
}

/** Docker container prefix options. */
export type PrefixOption = {
  /** Prefix to add to a Docker container name. */
  prefix?: string
}

/** Docker image tag options. */
export type TargetOption = {
  /** Target tag of image to use. This is the `:version` component of the full tag. */
  target: string
}

/** Configure a command with Docker registry authentication options. */
export const configureAuth = (cmd: Command): void => {
  cmd.option('--registry-password <password>', 'Edge Docker registry password')
  cmd.option('--registry-username <username>', 'Edge Docker registry username')
}

/** Configure a command with Docker connection options. */
export const configureConnection = (cmd: Command): void => {
  cmd.option('--docker-socket-path <path>', 'Docker socket path')
}

/** Configure a command with Docker environment options. */
export const configureEnv = (cmd: Command): void => {
  cmd.option('-e, --env <var...>', 'set environment variable(s) for node')
}

/** Configure a command with Docker networking options. */
export const configureNetworks = (cmd: Command): void => {
  cmd.option('--network <var...>', 'set network(s) for node')
}

/** Configure a command with Docker container prefix options. */
export const configurePrefix = (cmd: Command): void => {
  cmd.option('--prefix <prefix>', 'Docker entity prefix')
}

/** Configure a command with Docker image tag options. */
export const configureTarget = (cmd: Command): void => {
  cmd.option('--target <version>', 'node target version')
}

/** Read Docker registry authentication options from a command. */
export const readAuth = (cmd: Command): AuthConfig | undefined => {
  const opts = cmd.opts()
  if (opts.registryUsername || config.docker.edgeRegistry.auth.username) {
    return {
      serveraddress: config.docker.edgeRegistry.address,
      username: opts.registryUsername || config.docker.edgeRegistry.auth.username,
      password: opts.registryPassword || config.docker.edgeRegistry.auth.password
    }
  }
  return undefined
}

/** Read Docker connection options from a command. */
export const readConnection = (cmd: Command): DockerOptions => {
  const opts = cmd.opts()

  if (opts.dockerSocketPath) return { socketPath: opts.dockerSocketPath }

  // return empty options and let docker-modem set default options for windows or linux
  return {}
}

/** Read Docker environment options from a command. */
export const readEnv = (cmd: Command): EnvOption => {
  const opts = cmd.opts()
  return {
    env: opts.env !== undefined ? opts.env : []
  }
}

/** Read Docker network options from a command. */
export const readNetworks = (cmd: Command): NetworksOption => {
  const opts = cmd.opts()
  return { network: opts.network }
}

/** Read Docker container prefix options from a command. */
export const readPrefix = (cmd: Command): PrefixOption => {
  const opts = cmd.opts()
  if (opts.prefix) {
    const format = /^[a-z0-9]+$/
    if (!format.test(opts.prefix)) throw new Error('prefix may only contain lowercase alphanumeric characters')
  }
  return { prefix: opts.prefix }
}

/** Read Docker image tag options from a command. */
export const readTarget = async ({ cmd, network }: CommandContext, name: string): Promise<TargetOption> => {
  const opts = cmd.opts()
  return {
    target: opts.target || (await sg.service.get(network.stargate.host, name)).version
  }
}
