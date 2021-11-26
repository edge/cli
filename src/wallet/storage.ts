// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { dirname } from 'path'
import { namedError } from '../helpers'
import { EncryptedWallet, Wallet, decryptWallet, encryptWallet } from './wallet'
import { HashPair, compare, createSalt, hash } from './hash'
import { mkdir, readFile, stat, writeFile } from 'fs'

export type FileWallet = EncryptedWallet & {
  secret: HashPair
}

const notFoundError = namedError('NotFoundError')

const checkFile = (file: string) => new Promise<boolean>((resolve, reject) => {
  stat(file, (err, info) => {
    if (err !== null) {
      if (err.code === 'ENOENT') return resolve(false)
      return reject(err)
    }
    if (info.isDirectory()) return reject(`${file} is a directory`)
    return resolve(info.isFile())
  })
})

const prepareDirectory = (file: string) => new Promise<void>((resolve, reject) => {
  const dir = dirname(file)
  mkdir(dir, { recursive: true }, err => {
    if (err !== null) return reject(err)
    return resolve()
  })
})

export const createFileWallet = (wallet: Wallet, passphrase: string): FileWallet => ({
  ...encryptWallet(wallet, passphrase),
  secret: hash(passphrase, createSalt())
})

export const decryptFileWallet = (wallet: FileWallet, passphrase: string): Wallet => {
  if (!compare(passphrase, wallet.secret)) throw new Error('invalid passphrase')
  return decryptWallet(wallet, passphrase)
}

export const readWallet = async (file: string): Promise<FileWallet> => {
  try {
    const exists = await checkFile(file)
    if (!exists) throw notFoundError('wallet not found')
    const wallet = await new Promise<FileWallet>((resolve, reject) => readFile(file, (err, data) => {
      if (err !== null) return reject(err)
      const wallet = JSON.parse(data.toString())
      return resolve(wallet)
    }))
    return wallet
  }
  catch(err) {
    if ((err as Error).name === 'NotFoundError') throw err
    throw new Error(`failed to read wallet: ${(err as Error).message}`)
  }
}

export const writeWallet = async (file: string, wallet: FileWallet): Promise<void> => {
  try {
    await prepareDirectory(file)
    const data = JSON.stringify(wallet)
    await new Promise<void>((resolve, reject) => writeFile(file, data, err => {
      if (err !== null) return reject(err)
      return resolve()
    }))
  }
  catch(err) {
    throw new Error(`failed to write wallet: ${(err as Error).message}`)
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const withFile = (file: string) => {
  // stateful encrypted wallet to avoid re-reading from disk
  let enc: FileWallet

  const getEnc = async () => {
    if (enc === undefined) enc = await readWallet(file)
    return enc
  }

  return {
    address: async () => (await getEnc()).address,
    check: () => checkFile(file),
    read: async (passphrase: string) => decryptFileWallet(await getEnc(), passphrase),
    write: async (wallet: Wallet, passphrase: string) => {
      const newEnc = createFileWallet(wallet, passphrase)
      await writeWallet(file, newEnc)
      enc = newEnc
    }
  }
}
