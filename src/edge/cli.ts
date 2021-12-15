// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Command } from 'commander'
import pkg from '../../package.json'
import { toUpperCaseFirst } from '../helpers'
import { Context, Network } from '..'

export const create = (network: Network): Command => {
  const version = `Edge CLI v${pkg.version} (${toUpperCaseFirst(network.name)})`
  const desc = `Edge CLI (${toUpperCaseFirst(network.name)})`

  const parent = new Command(network.appName)
    .version(version)
    .description(desc)
    .option('--debug', 'enable detailed error and debug messages')
    .option('--no-color', 'disable terminal text colors')
    .option('-v, --verbose', 'enable detailed output')

  return parent
}

export const errorHandler =
  <T>({ parent, ...ctx }: Context, f: (...args: any[]) => Promise<T>) =>
    async (...args: any[]): Promise<T|undefined> => {
      try {
        return await f(...args)
      }
      catch (err) {
        if (!isCancelledInput(err)) {
          const log = ctx.logger('critical')
          const { debug } = getDebugOption(parent)
          log.error(`${err}`, debug ? { err } : undefined)
        }
        process.exitCode = 1
      }
      return undefined
    }

export const getDebugOption = (parent: Command): { debug: boolean } => {
  const { debug } = parent.opts<{ debug: boolean }>()
  return { debug }
}

export const getNoColorOption = (parent: Command): { noColor: boolean } => {
  const { noColor } = parent.opts<{ noColor: boolean }>()
  return { noColor }
}

export const getVerboseOption = (parent: Command): { verbose: boolean } => {
  const { verbose } = parent.opts<{ verbose: boolean }>()
  return { verbose }
}

const isCancelledInput = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false
  return err.name === 'InputError' && err.message === 'cancelled'
}
