import * as cli from '../../cli'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { formatXE } from '../../transaction/xe'
import { xeVars } from '.'
import { CommandContext, Context } from '../..'

/**
 * Display on-chain staking info (`stake info`).
 */
export const action = ({ xe, ...ctx }: CommandContext) => async (): Promise<void> => {
  const { debug } = cli.debug.read(ctx.parent)

  const vars = await xeVars(xe, debug)

  const amounts = [
    vars.host_stake_amount,
    vars.gateway_stake_amount,
    vars.stargate_stake_amount
  ].map(mxe => formatXE(mxe))
  const longest = amounts.reduce((l, s) => Math.max(l, s.length), 0)
  const [hostAmt, gatewayAmt, stargateAmt] = amounts.map(a => a.padStart(longest, ' '))

  console.log('Current staking amounts:')
  console.log(`  Stargate: ${stargateAmt}`)
  console.log(`  Gateway:  ${gatewayAmt}`)
  console.log(`  Host:     ${hostAmt}`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('info').description('get on-chain staking information').addHelpText('after', help)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = `
Displays current staking amounts.
`
