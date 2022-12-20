import * as cli from '../../cli'
import * as repl from '../../repl'
import * as xeUtils from '@edge/xe-utils'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { formatXE } from '../../transaction/xe'
import { toUpperCaseFirst } from '../../helpers'
import { types } from '..'
import { xeVars } from '.'
import { CommandContext, Context, Network } from '../..'
import { askToSignTx, handleCreateTxResult } from '../../transaction'

/**
 * Create a stake (`stake create`).
 */
export const action = (ctx: CommandContext) => async (nodeType: string): Promise<void> => {
  const opts = {
    ...cli.debug.read(ctx.parent),
    ...await cli.passphrase.read(ctx.cmd),
    ...cli.yes.read(ctx.cmd)
  }

  if (!types.includes(nodeType)) throw new Error(`invalid node type "${nodeType}"`)

  const wallet = ctx.wallet()
  const address = await wallet.address()

  const xeClient = ctx.xeClient()
  let onChainWallet = await xeClient.wallet(address)

  const vars = await xeVars(xeClient, opts.debug)
  // fallback 0 is just for typing - nodeType is checked at top of func, so it should never be used
  const amount =
    nodeType === 'host' ? vars.host_stake_amount :
      nodeType === 'gateway' ? vars.gateway_stake_amount :
        nodeType === 'stargate' ? vars.stargate_stake_amount : 0

  const resultBalance = onChainWallet.balance - amount
  // eslint-disable-next-line max-len
  if (resultBalance < 0) throw new Error(`insufficient balance to stake ${nodeType}: your wallet only contains ${formatXE(onChainWallet.balance)} (${formatXE(amount)} required)`)

  if (!opts.yes) {
    console.log(`You are staking ${formatXE(amount)} to run a ${toUpperCaseFirst(nodeType)}.`)
    console.log(
      `${formatXE(amount)} will be deducted from your available balance.`,
      `You will have ${formatXE(resultBalance)} remaining.`
    )
    console.log()
    if (await repl.askLetter('Proceed with staking?', 'yn') === 'n') return
    console.log()
  }

  await askToSignTx(opts)
  const hostWallet = await wallet.read(opts.passphrase as string)
  onChainWallet = await xeClient.walletWithNextNonce(address)

  const tx = xeUtils.tx.sign({
    timestamp: Date.now(),
    sender: hostWallet.address,
    recipient: hostWallet.address,
    amount,
    data: {
      action: 'create_stake',
      memo: `Create ${toUpperCaseFirst(nodeType)} Stake`
    },
    nonce: onChainWallet.nonce
  }, hostWallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(ctx.network, result)) process.exitCode = 1
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('create')
    .argument('<type>', `node type (${types.join('|')})`)
    .description('create a new stake')
    .addHelpText('after', help(ctx.network))
  cli.passphrase.configure(cmd)
  cli.yes.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = (network: Network) => `
This command will create a stake on the blockchain.

A stake enables your device to participate as a node in the network, providing capacity in exchange for XE.

Run '${network.appName} device add --help' for more information.
`
