import { Command } from 'commander'

const registerAction = (p: Command) => () => {
  console.debug('device register WIP', p.opts())
}

export const withProgram = (p: Command): void => {
  const deviceCLI = new Command('device')

  // edge device register
  const register = new Command('register')
    .description('register this device on the network')
    .action(registerAction(p))

  deviceCLI.addCommand(register)

  p.addCommand(deviceCLI)
}
