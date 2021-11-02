// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Command } from 'commander'
import { Network } from '../main'
import pkg from '../../package.json'

export type Options = {
  verbose: boolean
}

export const create = (network: Network): Command => {
  const cli = new Command('edge')
    .version(pkg.version)
    .enablePositionalOptions(true)
    .option('-v, --verbose', 'enable verbose error reporting', false)

  if (network.name === 'testnet') cli.description('Edge CLI (Testnet)')
  else cli.description('Edge CLI')
  return cli
}

export const errorHandler =
  <T>(cli: Command, f: (...args: any[]) => Promise<T>) =>
    async (...args: any[]): Promise<T|undefined> => {
      try {
        return await f(...args)
      }
      catch (err) {
        const { verbose } = getVerboseOption(cli)
        if (verbose) console.error(err)
        else console.error(`${err}`)
        process.exitCode = 1
      }
      return undefined
    }

export const errorHandlerSync =
  <T>(cli: Command, f: (...args: any[]) => T) =>
    (...args: any[]): T|undefined => {
      try {
        return f(...args)
      }
      catch (err) {
        const { verbose } = getVerboseOption(cli)
        if (verbose) console.error(err)
        else console.error(`${err}`)
        process.exitCode = 1
      }
      return undefined
    }

export const getVerboseOption = (cli: Command): Options => {
  const { verbose } = cli.opts<{ verbose: boolean }>()
  return { verbose }
}
