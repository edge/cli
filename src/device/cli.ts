import { Command } from 'commander'

const registerAction = (p: Command) => () => {
  console.debug('device register WIP', p.opts())
}

/**
 * Create a device CLI.
 *
 * Includes subcommand to register a device.
 *
 * @param p Parent program
 */
export const withProgram = (p: Command): void => {
  const deviceCLI = new Command('device')

  // edge device register
  const register = new Command('register')
    .description('register this device on the network')
    .action(registerAction(p))

  deviceCLI.addCommand(register)

  p.addCommand(deviceCLI)
}
