// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import os from 'os'
import { EncryptedWallet, Wallet, decryptWallet, encryptWallet } from './wallet'
import { HashPair, compare, createSalt, hash } from './hash'
import { dirname, sep } from 'path'
import { mkdir, readFile, stat, writeFile } from 'fs'

export type FileWallet = EncryptedWallet & {
  secret: HashPair
}

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

export const defaultFile = (): string => `${os.homedir}${sep}.xe-wallet.json`

export const decryptFileWallet = (wallet: FileWallet, passphrase: string): Wallet => {
  if (!compare(passphrase, wallet.secret)) throw new Error('invalid passphrase')
  return decryptWallet(wallet, passphrase)
}

const notFoundError = (msg: string) => {
  const err = new Error(msg)
  err.name = 'NotFoundError'
  return err
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
    prepareDirectory(file)
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
export const withFile = (file: string) => ({
  check: () => checkFile(file),
  read: async (passphrase: string) => decryptFileWallet(await readWallet(file), passphrase),
  write: async (wallet: Wallet, passphrase: string) => writeWallet(file, createFileWallet(wallet, passphrase))
})
