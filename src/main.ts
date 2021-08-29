import * as deviceCLI from './device/cli'
import * as stakeCLI from './stake/cli'
import { Command } from 'commander'

const cli = new Command('edge')
  .option('-v, --verbose', 'enable verbose logging', false)

deviceCLI.withProgram(cli)
stakeCLI.withProgram(cli)

cli.parse(process.argv)
