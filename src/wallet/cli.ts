import { readSecureValue } from '../secure'
import { Command, Option } from 'commander'
import { defaultFile, withFile } from './storage'
import { errorHandler, getOptions as getGlobalOptions } from '../edge/cli'
import {
  generateKeyPair,
  privateKeyToChecksumAddress,
  privateKeyToPublicKey,
  publicKeyToChecksumAddress
} from '@edge/wallet-utils'

const createAction = (parent: Command, createCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...getWalletOption(parent),
    ...await getSecretKeyOption(createCmd)
  }

  const keypair = generateKeyPair()
  const key = {
    public: keypair.getPublic(true, 'hex').toString(),
    private: keypair.getPrivate('hex').toString()
  }

  const address = publicKeyToChecksumAddress(key.public)
  const [, write] = withFile(opts.wallet)
  await write({ address, key }, opts.secretKey)
  console.log(`Wallet address: ${address}`)
  console.log(`Private key:    ${key.private}`)
  console.log('Ensure you copy your private key to a safe place!')
}

const infoAction = (parent: Command, infoCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...getWalletOption(parent),
    ...await getSecretKeyOption(infoCmd)
  }

  const [read] = withFile(opts.wallet)
  const wallet = await read(opts.secretKey)
  console.log('address:     ', wallet.address)
  console.log('public key:  ', wallet.key.public)
  console.log('private key: ', wallet.key.private)
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
  console.log(`Wallet address: ${address}`)
}

export const addPrivateKeyOption = (cmd: Command): void => {
  const options = [
    new Option('-p, --private-key <string>', 'wallet private key'),
    new Option('-P, --private-key-file <path>', 'file containing wallet private key')
  ]
  options.forEach(opt => cmd.addOption(opt))
}

export const addSecretKeyOption = (cmd: Command): void => {
  const options = [
    new Option('-k, --secret-key <string>', 'wallet secret key'),
    new Option('-K, --secret-key-file <path>', 'file containing wallet secret key')
  ]
  options.forEach(opt => cmd.addOption(opt))
}

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

const readPrivateKeyValue = readSecureValue('Enter private key: ', 'private key')
const readSecretKeyValue = readSecureValue('Enter secret key: ', 'secret key')

export const withProgram = (parent: Command): void => {
  const walletCLI = new Command('wallet')
    .description('manage wallet')

  // edge wallet create
  const create = new Command('create').description('create a new wallet')
  addSecretKeyOption(create)
  create.action(errorHandler(parent, createAction(parent, create)))

  const info = new Command('info').description('display wallet info')
  addSecretKeyOption(info)
  info.action(errorHandler(parent, infoAction(parent, info)))

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
