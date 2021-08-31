import { Command } from 'commander'

const registerAction = (parent: Command) => () => {
  console.debug('device register WIP', parent.opts())
}

const restartAction = (parent: Command) => () => {
  console.debug('device restart WIP', parent.opts())
}

const startAction = (parent: Command) => () => {
  console.debug('device start WIP', parent.opts())
}

const statusAction = (parent: Command) => () => {
  console.debug('device status WIP', parent.opts())
}

const stopAction = (parent: Command) => () => {
  console.debug('device stop WIP', parent.opts())
}

export const withProgram = (parent: Command): void => {
  const deviceCLI = new Command('device')
    .description('manage device')

  // edge device register
  const register = new Command('register')
    .description('register this device on the network')
    .action(registerAction(parent))

  // edge device restart
  const restart = new Command('restart')
    .description('restart services')
    .action(restartAction(parent))

  // edge device start
  const start = new Command('start')
    .description('start services')
    .action(startAction(parent))

  // edge device status
  const status = new Command('status')
    .description('display services status')
    .action(statusAction(parent))

  // edge device stop
  const stop = new Command('stop')
    .description('stop services')
    .action(stopAction(parent))

  deviceCLI
    .addCommand(register)
    .addCommand(restart)
    .addCommand(start)
    .addCommand(status)
    .addCommand(stop)

  parent.addCommand(deviceCLI)
}
