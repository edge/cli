import * as aboutCLI from './about/cli'
import * as deviceCLI from './device/cli'
import * as stakeCLI from './stake/cli'
import * as transactionCLI from './transaction/cli'
import * as updateCLI from './update/cli'
import * as walletCLI from './wallet/cli'
import { create as createCLI } from './edge/cli'
import indexClient from './api'
import { logger } from './log'
import { wallet } from './wallet'
import xeClient from './api/xe'
import { Context, Network } from '.'

const addProviders = (ctx: Pick<Context, 'parent' | 'network'>): Context => {
  const ctx2 = ctx as Context
  ctx2.index = (name?: string) => indexClient(ctx2, name)
  ctx2.logger = (name?: string) => logger(ctx2, name)
  ctx2.wallet = () => wallet(ctx2)
  ctx2.xe = (name?: string) => xeClient(ctx2, name)
  return ctx2
}

const main = (argv: string[], network: Network): void => {
  const parent = createCLI(network)
  aboutCLI.commands().forEach(cmd => parent.addCommand(cmd))
  const ctx = addProviders({ parent, network })

  if (network.flags.onboarding) parent.addCommand(deviceCLI.withContext(ctx))

  parent.addCommand(stakeCLI.withContext(ctx))
  parent.addCommand(transactionCLI.withContext(ctx))
  parent.addCommand(updateCLI.withContext(ctx, argv))

  const [walletCmd, walletOption] = walletCLI.withContext(ctx)
  parent.addCommand(walletCmd).addOption(walletOption)

  parent.parse(argv)
}

export default main
