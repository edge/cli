// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { checkVersionHandler } from '../update/cli'
import { errorHandler } from '../edge/cli'
import { formatXE } from '../transaction/xe'
import { wallet as xeWallet } from '@edge/xe-utils'
import { Command, Option } from 'commander'
import { CommandContext, Context, Network } from '..'
import { ask, askLetter, askSecure, getYesOption, yesOption } from '../input'
import { readFile, writeFile } from 'fs/promises'

export type PassphraseOption = {
  passphrase?: string
}

export type PrivateKeyOption = {
  privateKey?: string
}

export type WalletOption = {
  wallet: string
}

/**
 * Query the current host wallet balance (`wallet balance`).
 */
const balanceAction = ({ wallet, xe }: Context) => async () => {
  const address = await wallet().address()
  const { balance } = await xe().wallet(address)

  console.log(`Address: ${address}`)
  console.log(`Balance: ${formatXE(balance)}`)
}

/**
 * Create a new XE wallet and save it to the host, referred to elsewhere as the host wallet (`wallet create`).
 */
const createAction = ({ logger, wallet, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const opts = {
    ...await getPassphraseOption(ctx.cmd),
    ...getOverwriteOption(ctx.cmd),
    ...getPrivateKeyFileOption(ctx.cmd)
  }
  log.debug('options', opts)

  const storage = wallet()

  if (await storage.check() && !opts.overwrite) {
    if (await askLetter('A wallet already exists. Overwrite?', 'yn') === 'n') return
    console.log()
  }

  if (!opts.passphrase) {
    console.log('To ensure your wallet is secure it will be encrypted locally using a passphrase.')
    // console.log('For more information, see https://wiki.edge.network/TODO')
    console.log()
    const passphrase = await askSecure('Please enter a passphrase: ')
    if (passphrase.length === 0) throw new Error('passphrase required')
    const confirmKey = await askSecure('Please confirm passphrase: ')
    if (confirmKey !== passphrase) throw new Error('passphrases do not match')
    opts.passphrase = passphrase
    console.log()
  }

  const userWallet = xeWallet.create()
  await storage.write(userWallet, opts.passphrase)
  console.log(`Wallet ${userWallet.address} created.`)
  console.log()

  const nextStep = opts.privateKeyFile
    ? 'e'
    : await askLetter('Would you like to (v)iew or (e)xport your private key?', 'ven')

  if (nextStep === 'v') {
    console.log(`Private key: ${userWallet.privateKey}`)
    console.log()
    console.log('Keep your private key safe!')
    return
  }
  else if (nextStep === 'n') return

  let pkFile = opts.privateKeyFile || ''
  if (pkFile.length === 0) {
    while (pkFile.length === 0) {
      const input = await ask('Enter filename to export private key to: ')
      if (input.length) pkFile = input
    }
    console.log()
  }
  try {
    log.debug('writing file', { file: pkFile })
    await writeFile(pkFile, userWallet.privateKey)
    log.debug('wrote file', { file: pkFile })
    console.log(`Private key saved to ${pkFile}.`)
  }
  catch (err) {
    console.log('Failed to write to private key file. Displaying it instead...')
    console.log()
    console.log(`Private key: ${userWallet.privateKey}`)
    throw err
  }
}

/** Help text for the `wallet create` command. */
const createHelp = [
  '\n',
  'This command will create a new wallet.\n\n',
  'You will be asked to provide a passphrase to encrypt the wallet locally. ',
  'The passphrase is also required later to decrypt the wallet for certain actions, such as signing transactions.\n\n',
  'You will also be given the option to view or export the private key for the new wallet. ',
  'This should be copied to a secure location and kept secret.'
].join('')

/**
 * Display host wallet information (`wallet info`).
 */
const infoAction = ({ wallet, ...ctx }: CommandContext) => async () => {
  const storage = wallet()
  console.log(`Address: ${await storage.address()}`)

  const { passphrase } = await getPassphraseOption(ctx.cmd)
  if (passphrase) {
    try {
      const userWallet = await storage.read(passphrase)
      console.log(`Private key: ${userWallet.privateKey}`)
    }
    catch (err) {
      console.log(`Cannot display private key: ${(err as Error).message}`)
    }
  }
}

/** Help text for the `wallet info` command. */
const infoHelp = [
  '\n',
  'This command displays information about your wallet.\n\n',
  'If a passphrase is provided, this command will also decrypt and display your private key.'
].join('')

/**
 * Forget (remove) the host wallet (`wallet forget`).
 */
const forgetAction = ({ wallet, ...ctx }: CommandContext) => async () => {
  const storage = wallet()
  if (!await storage.check()) {
    console.log('No wallet found.')
    return
  }

  console.log(`Address: ${await storage.address()}`)

  if (!getYesOption(ctx.cmd).yes) {
    console.log()
    if (await askLetter('Are you sure you want to forget this wallet?', 'yn') === 'n') return
    console.log()
  }

  await storage.delete()
  console.log('Your wallet is forgotten.')
}

/** Help text for the `wallet forget` command. */
const forgetHelp = [
  '\n',
  'This command deletes your wallet from disk.'
].join('')

/**
 * Restore an XE wallet to the host using a private key (`wallet restore`).
 */
const restoreAction = ({ logger, wallet, ...ctx }: CommandContext) => async () => {
  const log = logger()

  const opts = {
    ...getOverwriteOption(ctx.cmd),
    ...await getPrivateKeyOption(ctx.cmd),
    ...await getPassphraseOption(ctx.cmd)
  }
  log.debug('options', opts)

  const storage = wallet()

  if (await storage.check() && !opts.overwrite) {
    if (await askLetter('A wallet already exists. Overwrite?', 'yn') === 'n') return
    console.log()
  }

  if (!opts.privateKey) {
    const privateKey = await askSecure('Please enter a private key: ')
    if (privateKey.length === 0) throw new Error('private key required')
    if (!xeWallet.validatePrivateKey(privateKey)) throw new Error('invalid private key')
    opts.privateKey = privateKey
    console.log()
  }

  if (!opts.passphrase) {
    console.log('To ensure your wallet is secure it will be encrypted locally using a passphrase.')
    // console.log('For more information, see https://wiki.edge.network/TODO')
    console.log()
    const passphrase = await askSecure('Please enter a passphrase: ')
    if (passphrase.length === 0) throw new Error('passphrase required')
    const confirmKey = await askSecure('Please confirm passphrase: ')
    if (confirmKey !== passphrase) throw new Error('passphrases do not match')
    opts.passphrase = passphrase
    console.log()
  }

  const userWallet = xeWallet.recover(opts.privateKey || '')
  await storage.write(userWallet, opts.passphrase)
  console.log(`Wallet ${userWallet.address} restored.`)
}

/** Help text for the `wallet restore` command. */
const restoreHelp = [
  '\n',
  'This command will restore an existing wallet using a private key you already have.\n\n',
  'You will be asked to provide a passphrase to encrypt the wallet locally. ',
  'The passphrase is also required later to decrypt the wallet for certain actions, such as signing transactions.'
].join('')

/** Get wallet overwrite option from user command. */
const getOverwriteOption = (cmd: Command) => {
  const opts = cmd.opts<{ overwrite?: boolean }>()
  return { overwrite: !!opts.overwrite }
}

/**
 * Get passphrase option from user command.
 * This checks both the `--passphrase` option (insecure) and the `--passphraseFile` option.
 */
export const getPassphraseOption = async (cmd: Command): Promise<PassphraseOption> => {
  type Input = Record<'passphrase' | 'passphraseFile', string|undefined>
  const { passphrase, passphraseFile: file } = cmd.opts<Input>()
  if (passphrase && passphrase.length) return { passphrase }
  // read secure value from file if set
  if (file !== undefined) {
    if (file.length === 0) throw new Error('no path to passphrase file')
    const data = await readFile(file)
    return { passphrase: data.toString() }
  }
  return {}
}

/**
 * Get private key option from user command.
 * This checks both the `--privateKey` option (insecure) and the `--privateKeyFile` option.
 */
export const getPrivateKeyOption = async (cmd: Command): Promise<PrivateKeyOption> => {
  type Input = Record<'privateKey' | 'privateKeyFile', string|undefined>
  const { privateKey, privateKeyFile: file } = cmd.opts<Input>()
  if (privateKey && privateKey.length) return { privateKey }
  // read secure value from file if set
  if (file !== undefined) {
    if (file.length === 0) throw new Error('no path to private key file')
    const data = await readFile(file)
    return { privateKey: data.toString() }
  }
  return {}
}

/** Get private key file option from user command. */
const getPrivateKeyFileOption = (cmd: Command) => {
  const { privateKeyFile } = cmd.opts<{ privateKeyFile: string }>()
  return { privateKeyFile }
}

/** Get wallet [file] option from user command. */
export const getWalletOption = (parent: Command, network: Network): WalletOption => {
  const { wallet } = parent.opts<Partial<WalletOption>>()
  return { wallet: wallet || network.wallet.defaultFile }
}

/** Create wallet overwrite option for CLI. */
const overwriteOption = (description = 'overwrite existing wallet if one exists') =>
  new Option('-f, --overwrite', description)

/** Create private key option for CLI. */
export const privateKeyOption = (): Option => new Option('-k, --private-key <string>', 'wallet private key')
/** Create private key file option for CLI. */
export const privateKeyFileOption = (): Option => new Option(
  '-K, --private-key-file <path>',
  'file containing wallet private key'
)

/** Create passphrase option for CLI. */
export const passphraseOption = (): Option => new Option('-p, --passphrase <string>', 'wallet passphrase')
/** Create passphrase file option for CLI. */
export const passphraseFileOption = (): Option => new Option(
  '-P, --passphrase-file <path>',
  'file containing wallet passphrase'
)

/** Configure `wallet` commands with root context. */
export const withContext = (ctx: Context): [Command, Option] => {
  const walletCLI = new Command('wallet')
    .description('manage wallet')

  // edge wallet balance
  const balance = new Command('balance')
    .description('check balance')
  balance.action(errorHandler(ctx, checkVersionHandler(ctx, balanceAction(ctx))))

  // edge wallet create
  const create = new Command('create')
    .description('create a new wallet')
    .addHelpText('after', createHelp)
    .addOption(overwriteOption())
    .addOption(passphraseOption())
    .addOption(passphraseFileOption())
    .addOption(privateKeyFileOption())
  create.action(errorHandler(ctx, checkVersionHandler(ctx, createAction({ ...ctx, cmd: create }))))

  // edge wallet forget
  const forget = new Command('forget')
    .description('forget saved wallet')
    .addHelpText('after', forgetHelp)
    .addOption(yesOption())
  forget.action(errorHandler(ctx, checkVersionHandler(ctx, forgetAction({ ...ctx, cmd: forget }))))

  // edge wallet info
  const info = new Command('info')
    .description('display saved wallet info')
    .addHelpText('after', infoHelp)
    .addOption(passphraseOption())
    .addOption(passphraseFileOption())
  info.action(errorHandler(ctx, checkVersionHandler(ctx, infoAction({ ...ctx, cmd: info }))))

  // edge wallet restore
  const restore = new Command('restore')
    .description('restore a wallet')
    .addHelpText('after', restoreHelp)
    .addOption(overwriteOption())
    .addOption(privateKeyOption())
    .addOption(privateKeyFileOption())
    .addOption(passphraseOption())
    .addOption(passphraseFileOption())
  restore.action(errorHandler(ctx, checkVersionHandler(ctx, restoreAction({ ...ctx, cmd: restore }))))

  walletCLI
    .addCommand(balance)
    .addCommand(create)
    .addCommand(forget)
    .addCommand(info)
    .addCommand(restore)

  return [walletCLI, new Option('-w, --wallet <file>', 'wallet file path')]
}
