import { Command } from 'commander'

const createAction = (p: Command) => () => {
  console.debug('stake create WIP', p.opts())
}

const listAction = (p: Command) => () => {
  console.debug('stake ls WIP', p.opts())
}

const releaseAction = (p: Command) => (id: string) => {
  console.debug('stake release WIP', p.opts(), id)
}

const unlockAction = (p: Command) => (id: string) => {
  console.debug('stake unlock WIP', p.opts(), id)
}

/**
 * Create a staking CLI.
 *
 * Includes subcommands to create, release, and unlock stakes.
 *
 * @param p Parent program
 */
export const withProgram = (p: Command): void => {
  const stakeCLI = new Command('stake')

  // edge stake create
  const create = new Command('create')
    .description('assign a new stake to this device')
    .action(createAction(p))

  // edge stake ls
  const list = new Command('ls')
    .description('list all stakes')
    .action(listAction(p))

  // edge stake release
  const release = new Command('release')
    .argument('<id>', 'stake ID')
    .description('release a stake')
    .action(releaseAction(p))

  // edge stake unlock
  const unlock = new Command('unlock')
    .argument('<id>', 'stake ID')
    .description('unlock a stake')
    .action(unlockAction(p))

  stakeCLI
    .addCommand(create)
    .addCommand(list)
    .addCommand(release)
    .addCommand(unlock)

  p.addCommand(stakeCLI)
}
