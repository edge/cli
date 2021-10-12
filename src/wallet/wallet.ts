import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export type EncryptedPair = {
  iv: string
  content: string
}

export type EncryptedWallet = Pick<Wallet, 'address'> & {
  privateKey: EncryptedPair
  publicKey: EncryptedPair
}

export type Wallet = {
  address: string
  privateKey: string
  publicKey: string
}

const decrypt = (encPair: EncryptedPair, passphrase: string): string => {
  const decipher = createDecipheriv('aes-256-ctr', resizePassphrase(passphrase), Buffer.from(encPair.iv, 'hex'))
  const value = Buffer.concat([decipher.update(Buffer.from(encPair.content, 'hex')), decipher.final()])
  return value.toString()
}

const encrypt = (value: string, passphrase: string): EncryptedPair => {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-ctr', resizePassphrase(passphrase), iv)
  const encValue = Buffer.concat([cipher.update(value), cipher.final()])
  return {
    iv: iv.toString('hex'),
    content: encValue.toString('hex')
  }
}

// right-pad passphrase input to ensure compatibility with cipher
const resizePassphrase = (passphrase: string): string => passphrase.padEnd(32, '0')

export const decryptWallet = (encWallet: EncryptedWallet, passphrase: string): Wallet => ({
  ...encWallet,
  privateKey: decrypt(encWallet.privateKey, passphrase),
  publicKey: decrypt(encWallet.publicKey, passphrase)
})

export const encryptWallet = (wallet: Wallet, passphrase: string): EncryptedWallet => ({
  ...wallet,
  privateKey: encrypt(wallet.privateKey, passphrase),
  publicKey: encrypt(wallet.publicKey, passphrase)
})
