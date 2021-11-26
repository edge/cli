// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Command } from 'commander'
import { Network } from '../main'
import color from './color'
import pkg from '../../package.json'
import { toUpperCaseFirst } from '../helpers'

export const create = (network: Network): Command => {
  const version = `Edge CLI v${pkg.version} (${toUpperCaseFirst(network.name)})`
  const desc = `Edge CLI (${toUpperCaseFirst(network.name)})`

  const cli = new Command(network.appName)
    .version(version)
    .description(desc)
    .enablePositionalOptions(true)
    .option('--no-color', 'disable terminal text colors')
    .option('-v, --verbose', 'enable verbose error reporting')

  return cli
}

export const errorHandler =
  <T>(cli: Command, f: (...args: any[]) => Promise<T>) =>
    async (...args: any[]): Promise<T|undefined> => {
      try {
        return await f(...args)
      }
      catch (err) {
        const { noColor, verbose } = {
          ...getNoColorOption(cli),
          ...getVerboseOption(cli)
        }
        if (verbose) console.error(err)
        else if (!noColor) console.error(color.error(`${err}`))
        else console.error(`${err}`)
        process.exitCode = 1
      }
      return undefined
    }

export const getNoColorOption = (cli: Command): { noColor: boolean } => {
  const { noColor } = cli.opts<{ noColor: boolean }>()
  return { noColor }
}

export const getVerboseOption = (cli: Command): { verbose: boolean } => {
  const { verbose } = cli.opts<{ verbose: boolean }>()
  return { verbose }
}
