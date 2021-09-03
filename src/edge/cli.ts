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

export const getOptions = (cli: Command): Options => {
  const opts = cli.opts<OptionsInput>()
  return {
    network: selectNetwork(opts.network),
    verbose: opts.verbose
  }
}
