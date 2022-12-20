import * as cli from '../../cli'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import config from '../../config'
import { errorHandler } from '../../cli'
import { CommandContext, Context } from '../..'
import { printData, toUpperCaseFirst } from '../../helpers'

/**
 * Display device information (`device info`).
 */
export const action = (ctx: CommandContext) => async (): Promise<void> => {
  const opts = {
    ...cli.debug.read(ctx.parent),
    ...cli.docker.readPrefix(ctx.cmd),
    ...cli.verbose.read(ctx.parent)
  }

  const log = ctx.logger()

  const printID = (id: string) => opts.verbose ? id: id.slice(0, config.id.shortLength)

  const userDevice = ctx.device(opts.prefix)
  const deviceWallet = await (await userDevice.volume()).read()

  const toPrint: Record<string, string> = {
    Network: toUpperCaseFirst(deviceWallet.network),
    Device: deviceWallet.address
  }

  try {
    const address = await ctx.wallet().address()
    const stake = Object.values(await ctx.xeClient().stakes(address)).find(s => s.device === deviceWallet.address)
    if (stake !== undefined) {
      toPrint.Type = toUpperCaseFirst(stake.type)
      toPrint.Stake = printID(stake.id)
    }
    else toPrint.Stake = 'Unassigned'
  }
  catch (err) {
    if (opts.debug) log.error(`${err}`, { err })
    toPrint.Stake = 'Unassigned (no wallet)'
  }

  console.log(printData(toPrint))
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('info').description('display device/stake information').addHelpText('after', help)
  cli.docker.configurePrefix(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

/** Help text for the `device info` command. */
const help = `
This command displays information about your device and the stake it is assigned to.
`
