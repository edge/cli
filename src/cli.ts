import { Command } from 'commander'

const deviceCLI = new Command('device')

const stakesCLI = new Command('stakes')

const cli = new Command('edge')
  .addCommand(deviceCLI)
  .addCommand(stakesCLI)
  .option('-v', 'Enable verbose logging', false)

export default cli
