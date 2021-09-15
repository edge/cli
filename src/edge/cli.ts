/* eslint-disable @typescript-eslint/no-explicit-any */
import { Command } from 'commander'
import { Network, selectNetwork } from '../config'

export type Options = {
  network: Network
  verbose: boolean
}

export type OptionsInput = {
  network: string
  verbose: boolean
}

export const create = (): Command => {
  const cli = new Command('edge')
    .enablePositionalOptions(true)
    .option('-n, --network <name>', 'network to use', 'test')
    .option('-v, --verbose', 'enable verbose logging', false)

  return cli
}

export const errorHandler =
  <T>(cli: Command, f: (...args: any[]) => Promise<T>) =>
    async (...args: any[]): Promise<T|undefined> => {
      try {
        return await f(...args)
      }
      catch (err) {
        const opts = getOptions(cli)
        if (opts.verbose) console.error(err)
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
        const opts = getOptions(cli)
        if (opts.verbose) console.error(err)
        else console.error(`${err}`)
        process.exitCode = 1
      }
      return undefined
    }

export const getOptions = (cli: Command): Options => {
  const opts = cli.opts<OptionsInput>()
  return {
    network: selectNetwork(opts.network),
    verbose: opts.verbose
  }
}
