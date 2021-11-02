import { Command } from 'commander'
import { Network } from '../main'
import { errorHandler } from '../edge/cli'
import { chmodSync, copyFileSync } from 'fs'
import { download, status } from '.'

const checkAction = (network: Network) => async (): Promise<void> => {
  const { current, latest, requireUpdate } = await status(network)
  if (requireUpdate) {
    console.log(`Current Edge CLI version: ${current}`)
    console.log()
    console.log('A new version of Edge CLI is available.')
    console.log(`Run 'edge update' to upgrade to ${latest}.`)
  }
  else console.log('Edge CLI is up to date.')
}

const checkHelp = [
  '\n',
  'Check for an update to Edge CLI.'
].join('')

const updateAction = (network: Network, argv: string[]) => async (): Promise<void> => {
  const { latest, requireUpdate } = await status(network)
  if (!requireUpdate) {
    console.log('Edge CLI is up to date.')
    return
  }

  const selfPath = argv[0]
  if (/node$/.test(selfPath)) throw new Error('path to binary appears to be node path')
  const { file } = await download(network)
  chmodSync(file, 0o755)
  copyFileSync(file, selfPath)

  console.log(`Updated Edge CLI to ${latest}`)
}

const updateHelp = [
  '\n',
  'Update Edge CLI to the latest version.\n\n',
  'To check for a new version without updating Edge CLI, use \'edge update check\' instead.'
].join('')

export const withProgram = (parent: Command, network: Network, argv: string[]): void => {
  const updateCLI = new Command('update')
    .description('update Edge CLI')
    .addHelpText('after', updateHelp)
    .action(errorHandler(parent, updateAction(network, argv)))

  const check = new Command('check')
    .description('check for updates')
    .addHelpText('after', checkHelp)
    .action(errorHandler(parent, checkAction(network)))

  updateCLI
    .addCommand(check)

  parent.addCommand(updateCLI)
}
