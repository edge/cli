import { writeFileSync } from 'fs'
import { Command, Option } from 'commander'
import { defaultFile, readWallet, withFile } from './storage'
import { errorHandler, getOptions as getGlobalOptions } from '../edge/cli'
import {
  generateKeyPair,
  privateKeyToChecksumAddress,
  privateKeyToPublicKey,
  publicKeyToChecksumAddress
} from '@edge/wallet-utils'
import { readSecureValue, readValue } from '../input'

const createAction = (parent: Command, createCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...getWalletOption(parent),
    ...await getSecretKeyOption(createCmd),
    ...await (async () => {
      let { privateKeyFile } = createCmd.opts<{ privateKeyFile: string | undefined }>()
      if (privateKeyFile === undefined) {
        console.log('Specify a private key file, or leave blank to display your private key.')
        privateKeyFile = await readValue(
          'Enter private key file: ',
          'private key file',
          false
        )
      }
      return { privateKeyFile }
    })()
  }

  const keypair = generateKeyPair()
  const key = {
    public: keypair.getPublic(true, 'hex').toString(),
    private: keypair.getPrivate('hex').toString()
  }
  const address = publicKeyToChecksumAddress(key.public)

  const [, write] = withFile(opts.wallet)
  await write({ address, key }, opts.secretKey)

  console.log('wallet address:', address)
  console.log('wallet file:', opts.wallet)

  if (opts.privateKeyFile.length) {
    try {
      writeFileSync(opts.privateKeyFile, key.private)
      console.log('private key file:', opts.privateKeyFile)
    }
    catch (err) {
      console.log('private key:', key.private)
      console.log('failed to write to private key file, displayed private key instead')
      console.error(err)
    }
  }
  else console.log('private key:', key.private)
}

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

  const key = {
    public: privateKeyToPublicKey(opts.privateKey),
    private: opts.privateKey
  }
  if (opts.verbose) console.debug('public key: ', key.public)

  const address = privateKeyToChecksumAddress(opts.privateKey)
  const [, write] = withFile(opts.wallet)
  await write({ address, key }, opts.secretKey)

  console.log('wallet address:', address)
  console.log('wallet file:', opts.wallet)
}

export const addPrivateKeyOption = (cmd: Command): void =>
  [privateKeyOption(), privateKeyFileOption()].forEach(opt => cmd.addOption(opt))

export const addSecretKeyOption = (cmd: Command): void =>
  [secretKeyOption(), secretKeyFileOption()].forEach(opt => cmd.addOption(opt))

export const getPrivateKeyOption = async (cmd: Command): Promise<{ privateKey: string }> => {
  const { privateKey, privateKeyFile } = cmd.opts<Record<'privateKey' | 'privateKeyFile', string|undefined>>()
  if (privateKey && privateKey.length > 0) return { privateKey }
  const input = await readPrivateKeyValue(privateKeyFile)
  return { privateKey: input }
}

export const getSecretKeyOption = async (cmd: Command): Promise<{ secretKey: string }> => {
  const { secretKey, secretKeyFile } = cmd.opts<Record<'secretKey' | 'secretKeyFile', string|undefined>>()
  if (secretKey && secretKey.length > 0) return { secretKey }
  const input = await readSecretKeyValue(secretKeyFile)
  return { secretKey: input }
}

export const getWalletOption = (parent: Command): { wallet: string } => {
  const { wallet } = parent.opts<{ wallet: string }>()
  return { wallet }
}

const privateKeyOption = () => new Option('-p, --private-key <string>', 'wallet private key')
const privateKeyFileOption = () => new Option('-P, --private-key-file <path>', 'file containing wallet private key')

const readPrivateKeyValue = readSecureValue('Enter private key: ', 'private key')
const readSecretKeyValue = readSecureValue('Enter secret key: ', 'secret key')

const secretKeyOption = () => new Option('-k, --secret-key <string>', 'wallet secret key')
const secretKeyFileOption = () => new Option('-K, --secret-key-file <path>', 'file containing wallet secret key')

export const withProgram = (parent: Command): void => {
  const walletCLI = new Command('wallet')
    .description('manage wallet')

  // edge wallet create
  const create = new Command('create')
    .description('create a new wallet')
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
    .option('-w, --wallet <file>', 'wallet file', defaultFile())
    .addCommand(walletCLI)
}
