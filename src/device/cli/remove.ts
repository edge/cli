import * as cli from '../../cli'
import * as repl from '../../repl'
import * as xeUtils from '@edge/xe-utils'
import { Command } from 'commander'
import { arch } from 'os'
import { checkVersionHandler } from '../../update/cli'
import config from '../../config'
import { errorHandler } from '../../cli'
import { toUpperCaseFirst } from '../../helpers'
import { CommandContext, Context } from '../..'
import { askToSignTx, handleCreateTxResult } from '../../transaction'

/**
 * Remove a device from the network (`device remove`).
 *
 * If the device is assigned to a stake, its assignment will be removed.
 * If the device is running, it will be stopped.
 * Afterwards, the data volume is removed, effectively 'destroying' the device.
 */
export const action = ({ device, logger, wallet, xe, ...ctx }: CommandContext) => async (): Promise<void> => {
  const log = logger()

  const opts = {
    ...await cli.passphrase.read(ctx.cmd),
    ...cli.docker.readPrefix(ctx.cmd)
  }
  const { yes } = cli.yes.read(ctx.cmd)

  const { verbose } = cli.verbose.read(ctx.parent)
  const printID = (id: string) => verbose ? id : id.slice(0, config.id.shortLength)

  const userDevice = device(opts.prefix)
  const docker = userDevice.docker()
  const volume = await userDevice.volume()
  const deviceWallet = await volume.read()

  const storage = wallet()
  const address = await storage.address()
  const xeClient = xe()
  const stake = Object.values(await xeClient.stakes(address)).find(s => s.device === deviceWallet.address)
  const nodeName = stake !== undefined ? toUpperCaseFirst(stake.type) : ''

  // confirm user intent
  if (!yes) {
    console.log(`You are removing this device from Edge ${toUpperCaseFirst(ctx.network.name)}.`)
    console.log()
    if (stake === undefined) console.log('This device is not assigned to any stake.')
    else console.log(`This will remove this device's assignment to stake ${printID(stake.id)} (${nodeName}).`)
    console.log()
    if (await repl.askLetter('Remove this device?', 'yn') === 'n') return
    console.log()
  }

  if (stake !== undefined) {
    // if node is running, stop it
    const imageName = ctx.network.registry.imageName(stake.type, arch())
    log.debug('finding node', { imageName })
    const node = await userDevice.node()
    const info = await node.container()
    if (info !== undefined) {
      log.debug('found container', { name: toUpperCaseFirst(stake.type), id: info.Id })
      const container = docker.getContainer(info.Id)
      console.log(`Stopping ${nodeName}...`)
      await container.stop()
      await container.remove()
      console.log()
    }

    // create unassignment tx
    await askToSignTx(opts)
    const userWallet = await storage.read(opts.passphrase as string)
    const onChainWallet = await xeClient.walletWithNextNonce(userWallet.address)

    const tx = xeUtils.tx.sign({
      timestamp: Date.now(),
      sender: userWallet.address,
      recipient: userWallet.address,
      amount: 0,
      data: {
        action: 'unassign_device',
        memo: 'Unassign Device',
        stake: stake.hash
      },
      nonce: onChainWallet.nonce
    }, userWallet.privateKey)

    console.log('Unassigning stake...')
    console.log()
    const result = await xeClient.createTransaction(tx)
    if (!handleCreateTxResult(ctx.network, result)) {
      process.exitCode = 1
      return
    }
    console.log()
  }

  await volume.remove()

  console.log(`This device has been removed from Edge ${toUpperCaseFirst(ctx.network.name)}.`)
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('remove').description('remove this device from the network').addHelpText('after', help)
  cli.docker.configurePrefix(cmd)
  cli.yes.configure(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

/** Help text for the `device remove` command. */
const help = `
This command removes this device from the network.

Removing a device will:
  - Unassign it from its stake
  - Stop the node (if it is running)
  - Destroy the device's identity
`
