import { Command } from 'commander'

export type Options = {
  verbose: boolean
}

export const create = (): Command => {
  const cli = new Command('edge')
    .enablePositionalOptions(true)
    .option('-v, --verbose', 'enable verbose logging', false)

  return cli
}

export const getOptions = (cli: Command): Options => {
  const opts = cli.opts<Options>()
  return {
    verbose: opts.verbose
  }
}
