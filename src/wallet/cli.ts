// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as xe from '@edge/xe-utils'
import { Network } from '../main'
import { checkVersionHandler } from '../update/cli'
import { errorHandler } from '../edge/cli'
import { formatXE } from '../transaction/xe'
import { Command, Option } from 'commander'
import { ask, askSecure } from '../input'
import { decryptFileWallet, readWallet, withFile } from './storage'
import { readFileSync, unlink, writeFileSync } from 'fs'

export type PassphraseOption = {
  passphrase?: string
}

export type PrivateKeyOption = {
  privateKey?: string
}

export type WalletOption = {
  wallet: string
}

const balanceAction = (parent: Command, network: Network) => async () => {
  const opts = getWalletOption(parent, network)
  const { address } = await readWallet(opts.wallet)

  const { balance } = await xe.wallet.info(network.blockchain.baseURL, address)

  console.log(`Address: ${address}`)
  console.log(`Balance: ${formatXE(balance)}`)
}

const createAction = (parent: Command, createCmd: Command, network: Network) => async () => {
  const opts = {
    ...getWalletOption(parent, network),
    ...getPassphraseOption(createCmd),
    ...(() => {
      const { privateKeyFile, overwrite } = createCmd.opts<{
        privateKeyFile: string | undefined
        overwrite: boolean
      }>()
      return { privateKeyFile, overwrite }
    })()
  }

  const { check, write } = withFile(opts.wallet)

  if (await check() && !opts.overwrite) {
    let confirm = ''
    const ynRegexp = /^[yn]$/
    while (confirm.length === 0) {
      const input = await ask('A wallet already exists. Overwrite? [yn] ')
      if (ynRegexp.test(input)) confirm = input
      else console.log('Please enter y or n.')
    }
    if (confirm === 'n') return
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

  const wallet = xe.wallet.create()
  await write(wallet, opts.passphrase)
  console.log(`Wallet ${wallet.address} created.`)
  console.log()

  let nextStep = opts.privateKeyFile ? 'e' : ''
  if (nextStep.length === 0) {
    const ynRegexp = /^[ven]$/
    while (nextStep.length === 0) {
      const input = await ask('Would you like to (v)iew or (e)xport your private key? [ven] ')
      if (ynRegexp.test(input)) nextStep = input
      else console.log('Please enter v, e, or n.')
    }
    console.log()
  }

  if (nextStep === 'v') {
    console.log(`Private key: ${wallet.privateKey}`)
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
    writeFileSync(pkFile, wallet.privateKey)
    console.log(`Private key saved to ${pkFile}.`)
  }
  catch (err) {
    console.log('Failed to write to private key file. Displaying it instead...')
    console.log()
    console.log(`Private key: ${wallet.privateKey}`)
    throw err
  }
}

const createHelp = [
  '\n',
  'This command will create a new wallet.\n\n',
  'You will be asked to provide a passphrase to encrypt the wallet locally. ',
  'The passphrase is also required later to decrypt the wallet for certain actions, such as signing transactions.\n\n',
  'You will also be given the option to view or export the private key for the new wallet. ',
  'This should be copied to a secure location and kept secret.'
].join('')

const infoAction = (parent: Command, infoCmd: Command, network: Network) => async () => {
  const opts = {
    ...getWalletOption(parent, network),
    ...getPassphraseOption(infoCmd)
  }

  const wallet = await readWallet(opts.wallet)
  console.log(`Wallet address: ${wallet.address}`)

  if (opts.passphrase) {
    try {
      const decrypted = decryptFileWallet(wallet, opts.passphrase)
      console.log(`Private key: ${decrypted.privateKey}`)
    }
    catch (err) {
      console.log(`Cannot display private key: ${(err as Error).message}`)
    }
  }
}

const infoHelp = [
  '\n',
  'This command displays information about your wallet.\n\n',
  'If a passphrase is provided, this command will also decrypt and display your private key.'
].join('')

const forgetAction = (parent: Command, forgetCmd: Command, network: Network) => async () => {
  const opts = {
    ...getWalletOption(parent, network),
    ...(() => {
      const { yes } = forgetCmd.opts<{ yes: boolean }>()
      return { yes }
    })()
  }

  const { check } = withFile(opts.wallet)
  if (!await check()) {
    console.log('No wallet found.')
    return
  }

  const wallet = await readWallet(opts.wallet)
  console.log(`Wallet address: ${wallet.address}`)

  if (!opts.yes) {
    console.log()
    let confirm = ''
    const ynRegexp = /^[yn]$/
    while (confirm.length === 0) {
      const input = await ask('Are you sure you want to forget this wallet? [yn] ')
      if (ynRegexp.test(input)) confirm = input
      else console.log('Please enter y or n.')
    }
    if (confirm === 'n') return
    console.log()
  }

  unlink(opts.wallet, err => {
    if (err !== null) throw err
    console.log('Your wallet is forgotten.')
  })
}

const forgetHelp = [
  '\n',
  'This command deletes your wallet from disk.'
].join('')

const restoreAction = (parent: Command, restoreCmd: Command, network: Network) => async () => {
  const opts = {
    ...getWalletOption(parent, network),
    ...(() => {
      const { overwrite } = restoreCmd.opts<{ overwrite: boolean }>()
      return { overwrite }
    })(),
    ...getPrivateKeyOption(restoreCmd),
    ...getPassphraseOption(restoreCmd)
  }

  const { check, write } = withFile(opts.wallet)

  if (await check() && !opts.overwrite) {
    let confirm = ''
    const ynRegexp = /^[yn]$/
    while (confirm.length === 0) {
      const input = await ask('A wallet already exists. Overwrite? [yn] ')
      if (ynRegexp.test(input)) confirm = input
      else console.log('Please enter y or n.')
    }
    if (confirm === 'n') return
    console.log()
  }

  if (!opts.privateKey) {
    const privateKey = await askSecure('Please enter a private key: ')
    if (privateKey.length === 0) throw new Error('private key required')
    if (!xe.wallet.validatePrivateKey(privateKey)) throw new Error('invalid private key')
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

  const wallet = xe.wallet.recover(opts.privateKey || '')
  await write(wallet, opts.passphrase)
  console.log(`Wallet ${wallet.address} restored.`)
}

const restoreHelp = [
  '\n',
  'This command will restore an existing wallet using a private key you already have.\n\n',
  'You will be asked to provide a passphrase to encrypt the wallet locally. ',
  'The passphrase is also required later to decrypt the wallet for certain actions, such as signing transactions.\n\n'
].join('')

export const getPassphraseOption = (cmd: Command): PassphraseOption => {
  type Input = Record<'passphrase' | 'passphraseFile', string|undefined>
  const { passphrase, passphraseFile: file } = cmd.opts<Input>()
  if (passphrase && passphrase.length) return { passphrase }
  // read secure value from file if set
  if (file !== undefined) {
    if (file.length === 0) throw new Error('no path to passphrase file')
    const data = readFileSync(file)
    return { passphrase: data.toString() }
  }
  return {}
}

export const getPrivateKeyOption = (cmd: Command): PrivateKeyOption => {
  type Input = Record<'privateKey' | 'privateKeyFile', string|undefined>
  const { privateKey, privateKeyFile: file } = cmd.opts<Input>()
  if (privateKey && privateKey.length) return { privateKey }
  // read secure value from file if set
  if (file !== undefined) {
    if (file.length === 0) throw new Error('no path to private key file')
    const data = readFileSync(file)
    return { privateKey: data.toString() }
  }
  return {}
}

export const getWalletOption = (parent: Command, network: Network): WalletOption => {
  const { wallet } = parent.opts<Partial<WalletOption>>()
  return { wallet: wallet || network.wallet.defaultFile }
}

export const privateKeyOption = (): Option => new Option('-k, --private-key <string>', 'wallet private key')
export const privateKeyFileOption = (): Option => new Option(
  '-K, --private-key-file <path>',
  'file containing wallet private key'
)

export const passphraseOption = (): Option => new Option('-p, --passphrase <string>', 'wallet passphrase')
export const passphraseFileOption = (): Option => new Option(
  '-P, --passphrase-file <path>',
  'file containing wallet passphrase'
)

export const withProgram = (parent: Command, network: Network): void => {
  const walletCLI = new Command('wallet')
    .description('manage wallet')

  // edge wallet balance
  const balance = new Command('balance')
    .description('check balance')
  balance.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        balanceAction(parent, network)
      )
    )
  )

  // edge wallet create
  const create = new Command('create')
    .description('create a new wallet')
    .addHelpText('after', createHelp)
    .option('-f, --overwrite', 'overwrite existing wallet if one exists')
    .addOption(passphraseOption())
    .addOption(passphraseFileOption())
    .addOption(privateKeyFileOption())
  create.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        createAction(parent, create, network)
      )
    )
  )

  // edge wallet forget
  const forget = new Command('forget')
    .description('forget saved wallet')
    .addHelpText('after', forgetHelp)
    .option('-y, --yes', 'do not ask for confirmation')
  forget.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        forgetAction(parent, forget, network)
      )
    )
  )

  // edge wallet info
  const info = new Command('info')
    .description('display saved wallet info')
    .addHelpText('after', infoHelp)
    .addOption(passphraseOption())
    .addOption(passphraseFileOption())
  info.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        infoAction(parent, info, network)
      )
    )
  )

  // edge wallet restore
  const restore = new Command('restore')
    .description('restore a wallet')
    .addHelpText('after', restoreHelp)
    .option('-f, --overwrite', 'overwrite existing wallet if one exists')
    .addOption(privateKeyOption())
    .addOption(privateKeyFileOption())
    .addOption(passphraseOption())
    .addOption(passphraseFileOption())
  restore.action(
    errorHandler(
      parent,
      checkVersionHandler(
        parent,
        network,
        restoreAction(parent, restore, network)
      )
    )
  )

  walletCLI
    .addCommand(balance)
    .addCommand(create)
    .addCommand(forget)
    .addCommand(info)
    .addCommand(restore)

  parent
    .option('-w, --wallet <file>', 'wallet file path')
    .addCommand(walletCLI)
}
