import { pbkdf2Sync, randomBytes } from 'crypto'

export type HashPair = {
  hash: string
  salt: string
}

export const compare = (input: string, hashPair: HashPair): boolean => {
  const inputPair = hash(input, hashPair.salt)
  return inputPair.hash === hashPair.hash
}

export const createSalt = (): string => randomBytes(16).toString()

export const hash = (input: string, salt: string): HashPair => ({
  hash: pbkdf2Sync(input, salt, 1000, 64, 'sha512').toString(),
  salt: salt
})
