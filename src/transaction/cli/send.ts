import * as cli from '../../cli'
import * as repl from '../../repl'
import * as xeUtils from '@edge/xe-utils'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import { errorHandler } from '../../cli'
import { CommandContext, Context } from '../..'
import { askToSignTx, handleCreateTxResult } from '..'
import { formatXE, parseAmount } from '../xe'

/**
 * Send an XE transaction via the blockchain (`transaction send`).
 */
// eslint-disable-next-line max-len
export const action = (ctx: CommandContext) => async (amountInput: string, recipient: string): Promise<void> => {
  const opts = {
    ...await cli.passphrase.read(ctx.cmd),
    ...cli.memo.read(ctx.cmd),
    ...cli.yes.read(ctx.cmd)
  }

  const amount = parseAmount(amountInput)
  if (!xeUtils.wallet.validateAddress(recipient)) throw new Error('invalid recipient')

  const wallet = ctx.wallet()
  const address = await wallet.address()

  const xeClient = ctx.xeClient()
  let onChainWallet = await xeClient.wallet(address)

  const resultBalance = onChainWallet.balance - amount
  // eslint-disable-next-line max-len
  if (resultBalance < 0) throw new Error(`insufficient balance: your wallet only contains ${formatXE(onChainWallet.balance)}`)

  if (!opts.yes) {
    // eslint-disable-next-line max-len
    console.log(`You are sending ${formatXE(amount)} to ${recipient}${opts.memo ? ` with the memo, "${opts.memo}"` : ''}.`)
    console.log(
      `${formatXE(amount)} will be deducted from your wallet.`,
      `You will have ${formatXE(resultBalance)} remaining.`
    )
    console.log()
    if (await repl.askLetter('Proceed with transaction?', 'yn') === 'n') return
    console.log()
  }

  await askToSignTx(opts)
  const hostWallet = await wallet.read(opts.passphrase as string)
  onChainWallet = await xeClient.walletWithNextNonce(address)

  const data: xeUtils.tx.TxData = {}
  if (opts.memo) data.memo = opts.memo
  const tx = xeUtils.tx.sign({
    timestamp: Date.now(),
    sender: address,
    recipient,
    amount,
    data,
    nonce: onChainWallet.nonce
  }, hostWallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(ctx.network, result)) process.exitCode = 1
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('send')
    .argument('<amount>', 'amount in XE or mXE')
    .argument('<wallet>', 'recipient wallet address')
    .description('send XE to another wallet')
    .addHelpText('after', help)
  cli.memo.configure(cmd)
  cli.passphrase.configure(cmd)
  cli.yes.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

/* eslint-disable max-len */
const help = `
This command sends an XE transaction to any address you choose. <amount> may be specified as XE in the format "...xe" or as microXE in the format "...mxe" (both case-insensitive). If no unit is provided, XE is assumed.

Your private key will be used to sign the transaction. You must provide a passphrase to decrypt your private key.
`
/* eslint-enable max-len */
