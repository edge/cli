import * as cli from '../../cli'
import * as data from '../data'
import * as repl from '../../repl'
import * as xeUtils from '@edge/xe-utils'
import { Command } from 'commander'
import { checkVersionHandler } from '../../update/cli'
import config from '../../config'
import { errorHandler } from '../../cli'
import { toUpperCaseFirst } from '../../helpers'
import { CommandContext, Context, Network } from '../..'
import { askToSignTx, handleCreateTxResult } from '../../transaction'
import { canAssign, findOne, precedence as nodeTypePrecedence } from '../../stake'

/**
 * Add a device to the network (`device add`).
 *
 * This initializes the device as necessary, including creating a device data volume.
 */
// eslint-disable-next-line max-len
export const action = ({ cmd, device, index, network, parent, wallet, xe }: CommandContext) => async (): Promise<void> => {
  const opts = {
    ...await cli.passphrase.read(cmd),
    ...cli.docker.readPrefix(cmd),
    ...cli.stake.read(cmd),
    ...cli.yes.read(cmd)
  }
  const { yes } = cli.yes.read(cmd)

  const { verbose } = cli.verbose.read(parent)
  const printAddr = (id: string) => verbose ? id : id.slice(0, config.address.shortLength) + '...'
  const printID = (id: string) => verbose ? id : id.slice(0, config.id.shortLength)

  const userDevice = device(opts.prefix)

  // get device data. if none, initialize device on the fly
  const deviceWallet = await (async () => {
    const volume = await userDevice.volume(true)
    let w: data.Device | undefined = undefined
    try {
      w = await volume.read()
    }
    catch (err) {
      console.log('Initializing device...')
      w = { ...xeUtils.wallet.create(), network: network.name }
      await volume.write(w)
      console.log()
    }
    return w as data.Device
  })()

  // get user stakes, check whether device already assigned
  const storage = wallet()
  const address = await storage.address()
  const { results: stakes } = await index().stakes(address, { limit: 999 })
  if (Object.keys(stakes).length === 0) throw new Error('no stakes')

  const assigned = Object.values(stakes).find(s => s.device === deviceWallet.address)
  if (assigned !== undefined) {
    console.log([
      `This device is already assigned to stake ${printID(assigned.id)} `,
      `(${toUpperCaseFirst(assigned.type)}) on Edge ${toUpperCaseFirst(network.name)}.`
    ].join(''))
    console.log()
    console.log([
      `To reassign this device, run '${network.appName} device remove' first to remove it from the network, `,
      `then run '${network.appName} device add' again to add it back.`
    ].join(''))
    process.exitCode = 1
    return
  }

  // identify stake to assign device to
  const stake = await (async () => {
    if (opts.stake !== undefined) return findOne(stakes, opts.stake)

    console.log('Select a stake to assign this device to:')
    console.log()
    const numberedStakes = Object.values(stakes)
      .filter(canAssign)
      .sort((a, b) => {
        const posDiff = nodeTypePrecedence[a.type] - nodeTypePrecedence[b.type]
        return posDiff !== 0 ? posDiff : a.created - b.created
      })
    numberedStakes.forEach((stake, n) => console.log([
      `${n+1}. ${printID(stake.id)} (${toUpperCaseFirst(stake.type)})`,
      stake.device ? ` (assigned to ${printAddr(stake.device)})` : ''
    ].join('')))
    console.log()
    let sel = 0
    while (sel === 0) {
      const selstr = await repl.ask(`Enter a number: (1-${numberedStakes.length}) `)
      const tmpsel = parseInt(selstr)
      if (tmpsel > 0 && tmpsel <= numberedStakes.length) sel = tmpsel
      else console.log(`Please enter a number between 1 and ${numberedStakes.length}.`)
    }
    console.log()
    return numberedStakes[sel-1]
  })()

  if (!canAssign(stake)) {
    if (stake.released) throw new Error('this stake has been released')
    if (stake.unlockRequested) throw new Error('this stake is unlocked/unlocking and cannot be assigned')
    throw new Error('this stake cannot be assigned for an unknown reason')
  }

  // confirm user intent
  const nodeName = toUpperCaseFirst(stake.type)
  if (!yes) {
    console.log(`You are adding this device to Edge ${toUpperCaseFirst(network.name)}.`)
    console.log()
    console.log([
      `This device will be assigned to stake ${printID(stake.id)}, `,
      `allowing this device to operate a ${nodeName} node.`
    ].join(''))
    console.log()
    if (stake.device) {
      console.log([
        `This stake is already assigned to device ${printAddr(stake.device)} which will be removed from the network `,
        'if you assign this device in its place.'
      ].join(''))
      console.log()
    }
    if (await repl.askLetter('Add this device?', 'yn') === 'n') return
    console.log()
  }

  // create assignment tx
  await askToSignTx(opts)
  const userWallet = await storage.read(opts.passphrase as string)

  const xeClient = xe()
  const onChainWallet = await xeClient.walletWithNextNonce(userWallet.address)

  const tx = xeUtils.tx.sign({
    timestamp: Date.now(),
    sender: userWallet.address,
    recipient: userWallet.address,
    amount: 0,
    data: {
      action: 'assign_device',
      device: deviceWallet.address,
      memo: 'Assign Device',
      signature: xeUtils.wallet.generateSignature(deviceWallet.privateKey, deviceWallet.address),
      stake: stake.hash
    },
    nonce: onChainWallet.nonce
  }, userWallet.privateKey)

  const result = await xeClient.createTransaction(tx)
  if (!handleCreateTxResult(network, result)) {
    process.exitCode = 1
    return
  }

  // next steps advice
  console.log()
  console.log([
    `You may run '${network.appName} tx lsp' to check progress of your pending transaction. `,
    'When your stake transaction has been processed it will no longer be listed as pending.'
  ].join(''))
  console.log()
  console.log(`You can then run '${network.appName} device start' to start a ${nodeName} node on this device.`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('add').description('add this device to the network').addHelpText('after', help(ctx.network))
  cli.docker.configurePrefix(cmd)
  cli.stake.configure(cmd)
  cli.yes.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

/* eslint-disable max-len */
const help = (network: Network) => `
This command will add this device to the network, allowing it to operate as a node.

Adding a device will:
  - Initialize its identity if needed
  - Assign it to a stake

Stake assignment requires a blockchain transaction. After the transaction has been processed, this device can run a node corresponding to the stake type.

Before you run this command, ensure Docker is running and that you have an unassigned stake to assign this device to.

If you do not already have a stake, you can run '${network.appName} stake create' to get one.
`
/* eslint-enable max-len */
