import * as stargate from '../stargate'
import { Command } from 'commander'
import { CommandContext } from '..'
import config from '../config'
import { AuthConfig, DockerOptions } from 'dockerode'

export type EnvOption = {
  env: string[]
}

export type NetworksOption = {
  network?: string[]
}

export type PrefixOption = {
  prefix?: string
}

export type TargetOption = {
  target: string
}

export const configureAuth = (cmd: Command): void => {
  cmd.option('--registry-password <password>', 'Edge Docker registry password')
  cmd.option('--registry-username <username>', 'Edge Docker registry username')
}

export const configureConnection = (cmd: Command): void => {
  cmd.option('--docker-socket-path <path>', 'Docker socket path')
}

export const configureEnv = (cmd: Command): void => {
  cmd.option('-e, --env <var...>', 'set environment variable(s) for node')
}

/** Create Docker network option for CLI. */
export const configureNetworks = (cmd: Command): void => {
  cmd.option('--network <var...>', 'set network(s) for node')
}

export const configurePrefix = (cmd: Command): void => {
  cmd.option('--prefix <prefix>', 'Docker entity prefix')
}

/** Create target version option for CLI. */
export const configureTarget = (cmd: Command): void => {
  cmd.option('--target <version>', 'node target version')
}

/**
 * Get Edge Registry authentication options from user command or environment.
 */
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

/**
 * Get Docker options from user command, including the socket path.
 */
export const readConnection = (cmd: Command): DockerOptions => {
  const opts = cmd.opts()

  if (opts.dockerSocketPath) return { socketPath: opts.dockerSocketPath }

  // return empty options and let docker-modem set default options for windows or linux
  return {}
}

/**
 * Get Docker ENV inputs from user command.
 */
export const readEnv = (cmd: Command): EnvOption => {
  const opts = cmd.opts()
  return {
    env: opts.env !== undefined ? opts.env : []
  }
}

/**
 * Get Docker networks from user command.
 * This allows the device to join user-defined networks rather than the default bridge.
 */
export const readNetworks = (cmd: Command): NetworksOption => {
  const opts = cmd.opts()
  return { network: opts.network }
}

/**
 * Get entity prefix from user command.
 * This can be used to access a named node in Docker, and/or manage multiple nodes on the same Docker instance.
 */
export const readPrefix = (cmd: Command): PrefixOption => {
  const opts = cmd.opts()
  if (opts.prefix) {
    const format = /^[a-z0-9]+$/
    if (!format.test(opts.prefix)) throw new Error('prefix may only contain lowercase alphanumeric characters')
  }
  return { prefix: opts.prefix }
}

/**
 * Get target version option from user command.
 * This allows a particular version of the device software to be specified for use.
 */
export const readTarget = async ({ cmd, network }: CommandContext, name: string): Promise<TargetOption> => {
  const opts = cmd.opts()
  return {
    target: opts.target || await stargate.getServiceVersion(network, name)
  }
}
