import { Command } from 'commander'

const createAction = (parent: Command) => () => {
  console.debug('stake create WIP', parent.opts())
}

const listAction = (parent: Command) => () => {
  console.debug('stake ls WIP', parent.opts())
}

const releaseAction = (parent: Command, release: Command) => (id: string) => {
  console.debug('stake release WIP', parent.opts(), release.opts(), id)
}

const unlockAction = (parent: Command) => (id: string) => {
  console.debug('stake unlock WIP', parent.opts(), id)
}

export const withProgram = (parent: Command): void => {
  const stakeCLI = new Command('stake')
    .description('manage stakes')

  // edge stake create
  const create = new Command('create')
    .description('assign a new stake to this device')
    .action(createAction(parent))

  // edge stake ls
  const list = new Command('ls')
    .description('list all stakes')
    .action(listAction(parent))

  // edge stake release
  const release = new Command('release')
    .argument('<id>', 'stake ID')
    .description('release a stake')
    .option('-e, --express', 'express release', false)
    .addHelpText('after', [
      '\n',
      'The --express option instructs the blockchain to take a portion of your stake in return for an immediate ',
      'release of funds, rather than waiting for the unlock period to conclude.'
    ].join(''))
  release.action(releaseAction(parent, release))

  // edge stake unlock
  const unlock = new Command('unlock')
    .argument('<id>', 'stake ID')
    .description('unlock a stake')
    .action(unlockAction(parent))

  stakeCLI
    .addCommand(create)
    .addCommand(list)
    .addCommand(release)
    .addCommand(unlock)

  parent.addCommand(stakeCLI)
}
