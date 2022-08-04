// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

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

/** Decrypt an encrypted string. */
const decrypt = (encPair: EncryptedPair, passphrase: string): string => {
  const decipher = createDecipheriv('aes-256-ctr', resizePassphrase(passphrase), Buffer.from(encPair.iv, 'hex'))
  const value = Buffer.concat([decipher.update(Buffer.from(encPair.content, 'hex')), decipher.final()])
  return value.toString()
}

/** Encrypt a wallet. */
const encrypt = (value: string, passphrase: string): EncryptedPair => {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-ctr', resizePassphrase(passphrase), iv)
  const encValue = Buffer.concat([cipher.update(value), cipher.final()])
  return {
    iv: iv.toString('hex'),
    content: encValue.toString('hex')
  }
}

/**
 * Right-pad a passphrase input to ensure compatibility with the encryption cipher.
 */
const resizePassphrase = (passphrase: string): string => passphrase.padEnd(32, '0')

/**
 * Decrypt a wallet.
 * The passphrase given must be the same as originally given to `encryptWallet()`.
 */
export const decryptWallet = (encWallet: EncryptedWallet, passphrase: string): Wallet => ({
  ...encWallet,
  privateKey: decrypt(encWallet.privateKey, passphrase),
  publicKey: decrypt(encWallet.publicKey, passphrase)
})

/**
 * Encrypt a wallet using a passphrase.
 */
export const encryptWallet = (wallet: Wallet, passphrase: string): EncryptedWallet => ({
  ...wallet,
  privateKey: encrypt(wallet.privateKey, passphrase),
  publicKey: encrypt(wallet.publicKey, passphrase)
})
