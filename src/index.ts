// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import { Log } from '@edge/log'
import indexClient from './api'
import xeClient from './api/xe'

export type CommandContext = Context & {
  cmd: Command
}

export type Context = Providers & {
  parent: Command
  network: Network
}

export type IndexClientProvider = (name?: string) => ReturnType<typeof indexClient>

export type LoggerProvider = (name?: string) => Log

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
    imageName: (app: string) => string
  }
  wallet: {
    defaultFile: string
  }
}

export type Providers = {
  index: IndexClientProvider
  logger: LoggerProvider
  xe: XEClientProvider
}

export type XEClientProvider = (name?: string) => ReturnType<typeof xeClient>
