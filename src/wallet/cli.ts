import * as xe from '@edge/xe-utils'
import { Command, Option } from 'commander'
import { ask, askSecure } from '../input'
import { defaultFile, readWallet, withFile } from './storage'
import { errorHandler, getOptions as getGlobalOptions } from '../edge/cli'
import { readFileSync, writeFileSync } from 'fs'

const createAction = (parent: Command, createCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...getWalletOption(parent),
    ...await (async () => {
      const {
        privateKeyFile,
        overwrite
      } = createCmd.opts<{
        privateKeyFile: string | undefined
        overwrite: boolean
      }>()
      return { privateKeyFile, overwrite }
    })(),
    ...await getSecretKeyOption(createCmd)
  }

  const { check, write } = withFile(opts.wallet)

  if (await check()) {
    let confirm = opts.overwrite ? 'y' : ''
    if (confirm.length === 0) {
      const ynRegexp = /^[yn]$/
      while (confirm.length === 0) {
        const input = await ask('A wallet already exists. Overwrite? [yn] ')
        if (ynRegexp.test(input)) confirm = input
        else console.log('Please enter y or n.')
      }
      if (confirm === 'n') return
      console.log()
    }
  }

  if (!opts.secretKey) {
    console.log('To ensure your wallet is secure it will be encrypted locally using a secret key.')
    console.log('For more information, see https://wiki.edge.network/TODO')
    console.log()
    const secretKey = await askSecure('Please enter a secret key: ')
    if (secretKey.length === 0) throw new Error('secret key required')
    const confirmKey = await askSecure('Please confirm secret key: ')
    if (confirmKey !== secretKey) throw new Error('secret keys do not match')
    opts.secretKey = secretKey
    console.log()
  }

  const wallet = xe.wallet.create()
  await write(wallet, opts.secretKey)
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
    console.log()
    throw err
  }
}

const createHelp = [
  '\n',
  'This command will create a new wallet.\n\n',
  'You will be asked to provide a secret key to encrypt the wallet locally. ',
  'The secret key is also required later to decrypt the wallet for certain actions, such as signing transactions.\n\n',
  'You will also be given the option to view or export the private key for the new wallet. ',
  'This should be copied to a secure location and kept secret.'
].join('')

const infoAction = (parent: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...getWalletOption(parent)
  }

  const wallet = await readWallet(opts.wallet)

  console.log('wallet address:', wallet.address)
  console.log('wallet file:', opts.wallet)
}

const restoreAction = (parent: Command, restoreCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...getWalletOption(parent),
    ...await getPrivateKeyOption(restoreCmd),
    ...await getSecretKeyOption(restoreCmd)
  }

  const { write } = withFile(opts.wallet)

  const wallet = xe.wallet.recover(opts.privateKey || '')
  await write(wallet, opts.secretKey || '')

  console.log('wallet address:', wallet.address)
  console.log('wallet file:', opts.wallet)
}

export const addPrivateKeyOption = (cmd: Command): void =>
  [privateKeyOption(), privateKeyFileOption()].forEach(opt => cmd.addOption(opt))

export const addSecretKeyOption = (cmd: Command): void =>
  [secretKeyOption(), secretKeyFileOption()].forEach(opt => cmd.addOption(opt))

export const getPrivateKeyOption = async (cmd: Command): Promise<{ privateKey?: string }> => {
  const { privateKey, privateKeyFile: file } = cmd.opts<Record<'privateKey' | 'privateKeyFile', string|undefined>>()
  if (privateKey && privateKey.length) return { privateKey }
  // read secure value from file if set
  if (file !== undefined) {
    if (file.length === 0) throw new Error('no path to secret key file')
    const data = readFileSync(file)
    return { privateKey: data.toString() }
  }
  return {}
}

export const getSecretKeyOption = async (cmd: Command): Promise<{ secretKey?: string }> => {
  const { secretKey, secretKeyFile: file } = cmd.opts<Record<'secretKey' | 'secretKeyFile', string|undefined>>()
  if (secretKey && secretKey.length) return { secretKey }
  // read secure value from file if set
  if (file !== undefined) {
    if (file.length === 0) throw new Error('no path to secret key file')
    const data = readFileSync(file)
    return { secretKey: data.toString() }
  }
  return {}
}

export const getWalletOption = (parent: Command): { wallet: string } => {
  const { wallet } = parent.opts<{ wallet: string }>()
  if (wallet && wallet.length) return { wallet }
  return { wallet: defaultFile() }
}

const privateKeyOption = () => new Option('-p, --private-key <string>', 'wallet private key')
const privateKeyFileOption = () => new Option('-P, --private-key-file <path>', 'file containing wallet private key')

const secretKeyOption = () => new Option('-k, --secret-key <string>', 'wallet secret key')
const secretKeyFileOption = () => new Option('-K, --secret-key-file <path>', 'file containing wallet secret key')

export const withProgram = (parent: Command): void => {
  const walletCLI = new Command('wallet')
    .description('manage wallet')

  // edge wallet create
  const create = new Command('create')
    .description('create a new wallet')
    .addHelpText('after', createHelp)
    .option('-f, --overwrite', 'overwrite existing wallet if one exists')
    .addOption(privateKeyFileOption())
  addSecretKeyOption(create)
  create.action(errorHandler(parent, createAction(parent, create)))

  const info = new Command('info').description('display wallet info')
  addSecretKeyOption(info)
  info.action(errorHandler(parent, infoAction(parent)))

  // edge wallet restore
  const restore = new Command('restore').description('restore a wallet')
  addPrivateKeyOption(restore)
  addSecretKeyOption(restore)
  restore.action(errorHandler(parent, restoreAction(parent, restore)))

  walletCLI
    .addCommand(create)
    .addCommand(info)
    .addCommand(restore)

  parent
    .option('-w, --wallet <file>', 'wallet file path')
    .addCommand(walletCLI)
}
