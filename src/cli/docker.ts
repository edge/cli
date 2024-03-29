// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as sg from '@edge/stargate-utils'
import { Command } from 'commander'
import config from '../config'
import dotenv from 'dotenv'
import { AuthConfig, DockerOptions } from 'dockerode'
import { Context, Network } from '../main'
import { existsSync, readFileSync } from 'fs'

/** Docker environment (env) options. */
export type EnvOption = {
  /** Env variables to pass to a Docker container. */
  env: string[]
}

/** Docker environment (env) file options. */
export type EnvFileOption = {
  /** Env variables file to use for a Docker container. */
  envFile?: string
}

/** Docker extra hosts options. */
export type ExtraHostsOption = {
  /** Extra hosts configuration for a Docker container. */
  extraHosts: string[]
}

/** Docker Gateway options. */
export type GatewayOption = {
  /**
   * Gateway host - a specialised extra host configuration.
   * See `ExtraHostsOption`
   */
  gateway?: string
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

/** Docker Stargate options. */
export type StargateOption = {
  /**
   * Stargate host - a specialised extra host configuration.
   * See `ExtraHostsOption`
   */
  stargate?: string
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

/**
 * Configure a command with extra hosts for Docker.
 * This option breaks the naming pattern within this file as `add-host` is more understandable and consistent with
 * the equivalent usage in `docker run`.
 */
export const configureExtraHosts = (cmd: Command): void => {
  cmd.option('--add-host <host...>', 'configure /etc/hosts within node')
}

/** Configure a command with a Docker env file. */
export const configureEnvFile = (cmd: Command): void => {
  cmd.option('--env-file <path>', 'set environment variables file for node')
}

/** Configure a command with a Docker Gateway host. */
export const configureGateway = (cmd: Command): void => {
  cmd.option('--gateway <host>', 'set Gateway host for node (if applicable)')
}

/** Configure a command with Docker networking options. */
export const configureNetworks = (cmd: Command): void => {
  cmd.option('--network <var...>', 'set network(s) for node')
}

/** Configure a command with Docker container prefix options. */
export const configurePrefix = (cmd: Command): void => {
  cmd.option('--prefix <prefix>', 'Docker entity prefix')
}

/** Configure a command with a Docker Stargate host. */
export const configureStargate = (cmd: Command): void => {
  cmd.option('--stargate <host>', 'set Stargate host for node (if applicable)')
}

/** Configure a command with Docker image tag options. */
export const configureTarget = (cmd: Command): void => {
  cmd.option('--target <version>', 'node target version')
}

/**
 * Read **all** Docker environment (env) options from a command and an env file, if one is found.
 *
 * This method automatically combines passive and imperative env arguments into a single list.
 * The env file is read first, then the env arguments given to the command.
 * If an env variable is repeated, Docker will automatically give precedence to the latter value.
 *
 * See `readEnv()` and `readFileEnv()` for separate implementations.
 */
export const readAllEnv = (cmd: Command): EnvOption => {
  const env: string[] = []
  const { envFile } = readEnvFile(cmd)
  if (envFile) {
    const fileEnv = dotenv.parse(readFileSync(envFile))
    for (const key of Object.keys(fileEnv)) {
      env.push(`${key}=${fileEnv[key]}`)
    }
  }
  const { env: argEnv } = readEnv(cmd)
  for (const e of argEnv) env.push(e)
  return { env }
}

/** Read **all** extra host options for the Docker container from a command, including Gateway and Stargate hosts. */
export const readAllExtraHosts = (cmd: Command, network: Network): ExtraHostsOption => {
  const { extraHosts } = readExtraHosts(cmd)
  const { gateway } = readGateway(cmd)
  if (gateway) extraHosts.push(`${network.gateway.host}:${gateway}`)
  const { stargate } = readStargate(cmd)
  if (stargate) extraHosts.push(`${network.stargate.host}:${stargate}`)
  return { extraHosts }
}

/** Read Docker registry authentication options from a command. */
export const readAuth = (cmd: Command): AuthConfig | undefined => {
  const opts = cmd.opts()
  if (opts.registryUsername || config.docker.registry.auth.username) {
    return {
      serveraddress: config.docker.registry.address,
      username: opts.registryUsername || config.docker.registry.auth.username,
      password: opts.registryPassword || config.docker.registry.auth.password
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

/** Read Docker environment (env) options from a command. */
export const readEnv = (cmd: Command): EnvOption => {
  const opts = cmd.opts()
  return {
    env: opts.env !== undefined ? opts.env : []
  }
}

/**
 * Read Docker environment (env) file options from a command.
 *
 * If CLI self-configures using an env file, and no other env file is specified as an argument when using CLI, then
 * that env file is also used as a fallback for the Docker environment.
 * In other words, CLI and Docker by default share the same env file.
 */
export const readEnvFile = (cmd: Command): EnvFileOption => {
  const opts = cmd.opts()
  if (opts.envFile) return { envFile: opts.envFile }
  if (config.envFile && existsSync(config.envFile)) return { envFile: config.envFile }
  return { envFile: undefined }
}

/** Read Docker extra hosts option from a command. */
export const readExtraHosts = (cmd: Command): ExtraHostsOption => {
  const opts = cmd.opts()
  return {
    extraHosts: opts.addHost !== undefined ? opts.addHost : []
  }
}

/** Read Docker Gateway option from a command. */
export const readGateway = (cmd: Command): GatewayOption => {
  const opts = cmd.opts()
  return { gateway: opts.gateway }
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

/** Read Docker Stargate option from a command. */
export const readStargate = (cmd: Command): StargateOption => {
  const opts = cmd.opts()
  return { stargate: opts.stargate }
}

/** Read Docker image tag options from a command. */
export const readTarget = async ({ cmd, network }: Context, name: string): Promise<TargetOption> => {
  const opts = cmd.opts()
  return {
    target: opts.target || (await sg.service.get(network.stargate.url, name)).version
  }
}
