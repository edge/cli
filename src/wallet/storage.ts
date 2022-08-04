// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { dirname } from 'path'
import { namedError } from '../helpers'
import { EncryptedWallet, Wallet, decryptWallet, encryptWallet } from './wallet'
import { HashPair, compare, createSalt, hash } from './hash'
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises'

/**
 * A 'file wallet', or rather 'wallet file', contains encrypted wallet data plus the hashed secret (or passphrase)
 * used to encrypt that same data.
 * Only the wallet address is unobfuscated.
 *
 * This allows the wallet to be decrypted given the correct secret, and therefore usable for signing transactions.
 */
export type FileWallet = EncryptedWallet & {
  secret: HashPair
}

/** Wallet not found error. */
const notFoundError = namedError('NotFoundError')

/** Check whether a [wallet] file exists on disk. */
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

/**
 * Create a wallet file.
 */
export const createFileWallet = (wallet: Wallet, passphrase: string): FileWallet => ({
  ...encryptWallet(wallet, passphrase),
  secret: hash(passphrase, createSalt())
})

/**
 * Decrypt a wallet file.
 */
export const decryptFileWallet = (wallet: FileWallet, passphrase: string): Wallet => {
  if (!compare(passphrase, wallet.secret)) throw new Error('invalid passphrase')
  return decryptWallet(wallet, passphrase)
}

/**
 * Delete a [wallet] file.
 */
export const deleteFile = async (file: string): Promise<boolean> => {
  await checkFile(file) && await unlink(file)
  return true
}

/**
 * Create a directory to contain a [wallet] file.
 * This creates directories recursively if necessary.
 */
const prepareDirectory = async (file: string): Promise<void> => {
  const dir = dirname(file)
  await mkdir(dir, { recursive: true })
}

/**
 * Read a [wallet] file from disk.
 */
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

/**
 * Write a wallet file to disk.
 */
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
