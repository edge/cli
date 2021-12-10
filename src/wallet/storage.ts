// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { dirname } from 'path'
import { namedError } from '../helpers'
import { EncryptedWallet, Wallet, decryptWallet, encryptWallet } from './wallet'
import { HashPair, compare, createSalt, hash } from './hash'
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises'

export type FileWallet = EncryptedWallet & {
  secret: HashPair
}

const notFoundError = namedError('NotFoundError')

export const checkFile = async (file: string): Promise<boolean> => {
  try {
    const info = await stat(file)
    if (info.isDirectory()) throw new Error(`${file} is a directory`)
    return info.isFile()
  }
  catch (err) {
    if (err !== null && (err as { code: string }).code === 'ENOENT') return false
    throw err
  }
}

export const createFileWallet = (wallet: Wallet, passphrase: string): FileWallet => ({
  ...encryptWallet(wallet, passphrase),
  secret: hash(passphrase, createSalt())
})

export const decryptFileWallet = (wallet: FileWallet, passphrase: string): Wallet => {
  if (!compare(passphrase, wallet.secret)) throw new Error('invalid passphrase')
  return decryptWallet(wallet, passphrase)
}

export const deleteFile = async (file: string): Promise<boolean> => {
  await checkFile(file) && await unlink(file)
  return true
}

const prepareDirectory = async (file: string): Promise<void> => {
  const dir = dirname(file)
  await mkdir(dir, { recursive: true })
}

export const readWallet = async (file: string): Promise<FileWallet> => {
  try {
    const exists = await checkFile(file)
    if (!exists) throw notFoundError('wallet not found')
    const data = await readFile(file)
    return JSON.parse(data.toString())
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
    await writeFile(file, data)
  }
  catch(err) {
    throw new Error(`failed to write wallet: ${(err as Error).message}`)
  }
}
