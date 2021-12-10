import * as storage from './storage'
import { Context } from '..'
import { Wallet } from './wallet'
import { getWalletOption } from './cli'

const secure = (w: storage.FileWallet | Wallet): Wallet => ({
  address: w.address,
  publicKey: '****',
  privateKey: '****'
})

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const wallet = ({ logger, parent, network }: Context) => {
  const log = logger('wallet')
  const { wallet: file } = getWalletOption(parent, network)

  // stateful encrypted wallet to avoid re-reading from disk
  let enc: storage.FileWallet

  const getEnc = async () => {
    if (enc === undefined) {
      log.debug('reading file', { file })
      enc = await storage.readWallet(file)
      log.debug('read file', { wallet: secure(enc), file })
    }
    return enc
  }

  const address = async () => (await getEnc()).address

  const check = () => {
    log.debug('checking file', { file })
    return storage.checkFile(file)
  }

  const del = () => {
    log.debug('deleting file', { file })
    return storage.deleteFile(file)
  }

  const read = async (passphrase: string) => {
    const enc2 = await getEnc()
    log.debug('decrypting', { file })
    return storage.decryptFileWallet(enc2, passphrase)
  }

  const write = async (wallet: Wallet, passphrase: string) => {
    log.debug('writing file', { wallet: secure(wallet), file })
    const newEnc = storage.createFileWallet(wallet, passphrase)
    await storage.writeWallet(file, newEnc)
    enc = newEnc
  }

  return {
    address,
    check,
    delete: del,
    read,
    write
  }
}