import * as deviceCLI from './device/cli'
import * as stakeCLI from './stake/cli'
import * as transactionCLI from './transaction/cli'
import * as updateCLI from './update/cli'
import * as walletCLI from './wallet/cli'
import { create as createCLI } from './edge/cli'
import indexClient from './api'
import { logger } from './log'
import xeClient from './api/xe'
import { Context, Network } from '.'

const main = (argv: string[], network: Network): void => {
  const cli = createCLI(network)

  const ctx = <Context>{
    parent: cli,
    network
  }
  ctx.index = (name?: string) => indexClient(ctx, name)
  ctx.logger = (name?: string) => logger(ctx, name)
  ctx.xe = (name?: string) => xeClient(ctx, name)

  if (network.flags.onboarding) cli.addCommand(deviceCLI.withContext(ctx))

  cli.addCommand(stakeCLI.withContext(ctx))
  cli.addCommand(transactionCLI.withContext(ctx))
  cli.addCommand(updateCLI.withContext(ctx, argv))

  const [walletCmd, walletOption] = walletCLI.withContext(ctx)
  cli.addCommand(walletCmd).addOption(walletOption)

  cli.parse(argv)
}

export default main
