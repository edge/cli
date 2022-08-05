// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import { Log } from '@edge/log'
import device from './device'
import indexClient from './api'
import { wallet } from './wallet'
import xeClient from './api/xe'

/**
 * Context provided to a CLI command.
 * Essentially identical to the normal global context, but including the command itself.
 */
export type CommandContext = Context & {
  cmd: Command
}

/**
 * Global context.
 * This is passed around code to provide access to common objects, getters (providers), CLI options, etc.
 */
export type Context = Providers & {
  parent: Command
  network: Network
}

/**
 * Provider for a device object.
 *
 * `prefix` determines which device/node should be accessed; if undefined, it will default to an un-prefixed
 * (single) device/node.
 * `name` is used in logging.
 */
export type DeviceProvider = (prefix: string | undefined, name?: string) => ReturnType<typeof device>

/** Provider for an index API client. */
export type IndexClientProvider = (name?: string) => ReturnType<typeof indexClient>

/** Provider for the logger. */
export type LoggerProvider = (name?: string) => Log

/**
 * Network configuration.
 * Defines standard structure for per-network config.
 */
export type Network = {
  appName: string
  name: string
  blockchain: {
    baseURL: string
  }
  explorer: {
    baseURL: string
  }
  files: {
    latestBuildURL: (os: string, arch: string, ext: string) => string
    latestChecksumURL: (os: string, arch: string) => string
    latestVersionURL: (os: string, arch: string) => string
  }
  flags: Record<string, boolean>
  index: {
    baseURL: string
  }
  registry: {
    imageName: (app: string, arch: string) => string
  }
  stargate: {
    serviceURL: (app: string) => string
  }
  wallet: {
    defaultFile: string
  }
}

/**
 * Providers for all key objects.
 */
export type Providers = {
  device: DeviceProvider
  index: IndexClientProvider
  logger: LoggerProvider
  wallet: WalletProvider
  xe: XEClientProvider
}

/** Provider for the host wallet. */
export type WalletProvider = () => ReturnType<typeof wallet>

/** Provider for an XE blockchain API client. */
export type XEClientProvider = (name?: string) => ReturnType<typeof xeClient>
