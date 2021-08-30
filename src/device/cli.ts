import { Command } from 'commander'

const registerAction = (parent: Command) => () => {
  console.debug('device register WIP', parent.opts())
}

export const withProgram = (parent: Command): void => {
  const deviceCLI = new Command('device')

  // edge device register
  const register = new Command('register')
    .description('register this device on the network')
    .action(registerAction(parent))

  deviceCLI.addCommand(register)

  parent.addCommand(deviceCLI)
}
