import { Command } from 'commander'

const createAction = (parent: Command) => () => {
  console.debug('wallet create WIP', parent.opts())
}

const restoreAction = (parent: Command) => () => {
  console.debug('wallet restore WIP', parent.opts())
}

export const withProgram = (parent: Command): void => {
  const walletCLI = new Command('wallet')
    .description('manage wallet')

  // edge wallet create
  const create = new Command('create')
    .description('create a new wallet')
    .action(createAction(parent))

  // edge wallet restore
  const restore = new Command('restore')
    .description('restore a wallet')
    .action(restoreAction(parent))

  walletCLI
    .addCommand(create)
    .addCommand(restore)

  parent.addCommand(walletCLI)
}
