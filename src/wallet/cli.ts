import { Command } from 'commander'
import { getOptions as getGlobalOptions } from '../edge/cli'
import { defaultFile, withFile } from './storage'
import {
  generateKeyPair,
  privateKeyToChecksumAddress,
  privateKeyToPublicKey,
  publicKeyToChecksumAddress
} from '@edge/wallet-utils'

export type Options = {
  walletFile: string
}

type OptionsInput = {
  wallet: string
}

const createAction = (parent: Command) => async (password: string) => {
  const opts = { ...getGlobalOptions(parent), ...getOptions(parent) }

  const keypair = generateKeyPair()
  const key = {
    public: keypair.getPublic(true, 'hex').toString(),
    private: keypair.getPrivate('hex').toString()
  }
  if (opts.verbose) {
    console.debug('public key:  ', key.public)
    console.debug('private key: ', key.private)
  }

  const address = publicKeyToChecksumAddress(key.public)
  const [, write] = withFile(opts.walletFile)
  try {
    await write({ address, key }, password)
    console.log(`Your new wallet address is ${address}`)
  }
  catch (err) {
    console.error(err)
  }
}

const restoreAction = (parent: Command) => async (privateKey: string, password: string) => {
  const opts = { ...getGlobalOptions(parent), ...getOptions(parent) }

  const key = {
    public: privateKeyToPublicKey(privateKey),
    private: privateKey
  }
  if (opts.verbose) console.debug('public key: ', key.public)

  const address = privateKeyToChecksumAddress(privateKey)
  const [, write] = withFile(opts.walletFile)
  try {
    await write({ address, key }, password)
    console.log(`Your restored wallet address is ${address}`)
  }
  catch (err) {
    console.error(err)
  }
}

export const getOptions = (parent: Command): Options => {
  const opts = parent.opts<OptionsInput>()
  return {
    walletFile: opts.wallet
  }
}

export const withProgram = (parent: Command): void => {
  const walletCLI = new Command('wallet')
    .description('manage wallet')

  // edge wallet create
  const create = new Command('create')
    .argument('<password>', 'decryption password')
    .description('create a new wallet')
    .action(createAction(parent))

  // edge wallet restore
  const restore = new Command('restore')
    .argument('<private-key>', 'private key')
    .argument('<password>', 'decryption password')
    .description('restore a wallet')
    .action(restoreAction(parent))

  walletCLI
    .addCommand(create)
    .addCommand(restore)

  parent
    .option('-w, --wallet <file>', 'wallet file', defaultFile())
    .addCommand(walletCLI)
}
