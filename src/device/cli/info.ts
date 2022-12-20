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
export const action = ({ cmd, device, logger, parent, wallet, xe }: CommandContext) => async (): Promise<void> => {
  const log = logger()

  const { debug } = cli.debug.read(parent)
  const { prefix } = cli.docker.readPrefix(cmd)
  const { verbose } = cli.verbose.read(parent)
  const printID = (id: string) => verbose ? id: id.slice(0, config.id.shortLength)

  const userDevice = device(prefix)
  const deviceWallet = await (await userDevice.volume()).read()

  const toPrint: Record<string, string> = {
    Network: toUpperCaseFirst(deviceWallet.network),
    Device: deviceWallet.address
  }

  try {
    const address = await wallet().address()
    const stake = Object.values(await xe().stakes(address)).find(s => s.device === deviceWallet.address)
    if (stake !== undefined) {
      toPrint.Type = toUpperCaseFirst(stake.type)
      toPrint.Stake = printID(stake.id)
    }
    else toPrint.Stake = 'Unassigned'
  }
  catch (err) {
    if (debug) log.error(`${err}`, { err })
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
