import * as aboutCLI from './about/cli'
import * as deviceCLI from './device/cli'
import * as stakeCLI from './stake/cli'
import * as transactionCLI from './transaction/cli'
import * as updateCLI from './update/cli'
import * as walletCLI from './wallet/cli'
import { create as createCLI } from './edge/cli'
import device from './device'
import indexClient from './api'
import { logger } from './log'
import { wallet } from './wallet'
import xeClient from './api/xe'
import { Context, Network } from '.'

const addProviders = (inputCtx: Pick<Context, 'parent' | 'network'>): Context => {
  const ctx = inputCtx as Context
  ctx.device = (name?: string) => device(ctx, name)
  ctx.index = (name?: string) => indexClient(ctx, name)
  ctx.logger = (name?: string) => logger(ctx, name)
  ctx.wallet = () => wallet(ctx)
  ctx.xe = (name?: string) => xeClient(ctx, name)
  return ctx
}

const main = (argv: string[], network: Network): void => {
  const parent = createCLI(network)
  aboutCLI.commands().forEach(cmd => parent.addCommand(cmd))
  const ctx = addProviders({ parent, network })

  if (network.flags.onboarding) {
    const [deviceCmd, deviceOptions] = deviceCLI.withContext(ctx)
    parent.addCommand(deviceCmd)
    deviceOptions.forEach(opt => parent.addOption(opt))
  }

  parent.addCommand(stakeCLI.withContext(ctx))
  parent.addCommand(transactionCLI.withContext(ctx))
  parent.addCommand(updateCLI.withContext(ctx, argv))

  const [walletCmd, walletOption] = walletCLI.withContext(ctx)
  parent.addCommand(walletCmd).addOption(walletOption)

  parent.parse(argv)
}

export default main
