import readline from 'readline'
import { Command, Option } from 'commander'
import { defaultFile, withFile } from './storage'
import { errorHandler, getOptions as getGlobalOptions } from '../edge/cli'
import {
  generateKeyPair,
  privateKeyToChecksumAddress,
  privateKeyToPublicKey,
  publicKeyToChecksumAddress
} from '@edge/wallet-utils'
import { readFileSync } from 'fs'

export type Options = {
  wallet: {
    secretKey: string
    file: string
  }
}

type OptionsInput = {
  secretKey?: string
  secretKeyFile?: string
  wallet: string
}

const createAction = (parent: Command, createCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...await getOptions(parent, createCmd, true)
  }

  const keypair = generateKeyPair()
  const key = {
    public: keypair.getPublic(true, 'hex').toString(),
    private: keypair.getPrivate('hex').toString()
  }

  const address = publicKeyToChecksumAddress(key.public)
  const [, write] = withFile(opts.wallet.file)
  await write({ address, key }, opts.wallet.secretKey)
  console.log(`Wallet address: ${address}`)
  console.log(`Private key:    ${key.private}`)
  console.log('Ensure you copy your private key to a safe place!')
}

const infoAction = (parent: Command, infoCmd: Command) => async () => {
  const opts = {
    ...getGlobalOptions(parent),
    ...await getOptions(parent, infoCmd, true)
  }

  const [read] = withFile(opts.wallet.file)
  const wallet = await read(opts.wallet.secretKey)
  console.log('address:     ', wallet.address)
  console.log('public key:  ', wallet.key.public)
  console.log('private key: ', wallet.key.private)
}

const restoreAction = (parent: Command, restoreCmd: Command) => async (privateKey: string) => {
  const opts = {
    ...getGlobalOptions(parent),
    ...await getOptions(parent, restoreCmd, true)
  }

  const key = {
    public: privateKeyToPublicKey(privateKey),
    private: privateKey
  }
  if (opts.verbose) console.debug('public key: ', key.public)

  const address = privateKeyToChecksumAddress(privateKey)
  const [, write] = withFile(opts.wallet.file)
  await write({ address, key }, opts.wallet.secretKey)
  console.log(`Wallet address: ${address}`)
}

export const getOptions =
  (parent: Command, cmd: Command, requireSecret = false): Promise<Options> =>
    new Promise((resolve, reject) => {
      const opts = {
        ...parent.opts<Pick<OptionsInput, 'wallet'>>(),
        ...cmd.opts<Pick<OptionsInput, 'secretKey' | 'secretKeyFile'>>()
      }
      const ropts = {
        wallet: {
          secretKey: opts.secretKey || '',
          file: opts.wallet
        }
      }
      if (!requireSecret || ropts.wallet.secretKey.length > 0) return resolve(ropts)

      // if key file specified, attempt to read secret key from it
      if (opts.secretKeyFile !== undefined) {
        if (opts.secretKeyFile.length === 0) return reject(new Error('no path to secret key file'))
        try {
          const data = readFileSync(opts.secretKeyFile)
          ropts.wallet.secretKey = data.toString()
          return resolve(ropts)
        }
        catch (err) {
          return reject(err)
        }
      }

      // secret key not provided as option, try interactive prompt
      if (!process.stdout.isTTY) return reject(new Error('secret key required'))
      const rl = readline.createInterface(process.stdin, process.stdout)
      rl.on('close', () => {
        if (ropts.wallet.secretKey.length > 0) return resolve(ropts)
        return reject(new Error('secret key required'))
      })
      rl.question('Secret key: ', answer => {
        ropts.wallet.secretKey = answer
        rl.close()
      })
    })

export const secretKeyOption = (): Option => new Option(
  '-k, --secret-key <string>',
  'wallet secret key'
)

export const secretKeyFileOption = (): Option => new Option(
  '-K, --secret-key-file <path>',
  'file containing wallet secret key'
)

export const withProgram = (parent: Command): void => {
  const walletCLI = new Command('wallet')
    .description('manage wallet')

  // edge wallet create
  const create = new Command('create')
    .description('create a new wallet')
    .addOption(secretKeyOption())
    .addOption(secretKeyFileOption())
  create.action(errorHandler(parent, createAction(parent, create)))

  const info = new Command('info')
    .description('display wallet info')
    .addOption(secretKeyOption())
    .addOption(secretKeyFileOption())
  info.action(errorHandler(parent, infoAction(parent, info)))

  // edge wallet restore
  const restore = new Command('restore')
    .argument('<private-key>', 'private key')
    .description('restore a wallet')
    .addOption(secretKeyOption())
    .addOption(secretKeyFileOption())
  restore.action(errorHandler(parent, restoreAction(parent, restore)))

  walletCLI
    .addCommand(create)
    .addCommand(info)
    .addCommand(restore)

  parent
    .option('-w, --wallet <file>', 'wallet file', defaultFile())
    .addCommand(walletCLI)
}
