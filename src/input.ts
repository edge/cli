// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Writable } from 'stream'
import { namedError } from './helpers'
import readline from 'readline'
import { Command, Option } from 'commander'

const inputError = namedError('InputError')

export const ask = (question: string): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!process.stdout.isTTY) return reject(inputError('tty required'))
    const rl = readline.createInterface(process.stdin, process.stdout)
    let cancelled = false
    let valueAnswer = ''
    rl.on('close', () => {
      if (cancelled) return reject(inputError('cancelled'))
      return resolve(valueAnswer)
    })
    rl.question(question, answer => {
      valueAnswer = answer
      rl.close()
    })
    rl.on('SIGINT', () => {
      cancelled = true
      rl.close()
    })
  })

export const askLetter = async (question: string, allowChars: string): Promise<string> => {
  if (!process.stdout.isTTY) throw inputError('tty required')
  const allow = allowChars.split('')
  let answer = await ask(`${question} [${allowChars}] `)
  while (!allow.includes(answer)) {
    console.log(`Please enter ${allow.slice(0, allow.length-1).join(', ')} or ${allow[allow.length-1]}.`)
    answer = await ask(`${question} [${allowChars}] `)
  }
  return answer
}

export const askSecure = (question: string): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!process.stdout.isTTY) return reject(inputError('tty required'))
    const invisible = new Writable({
      write: (_chunk, _encoding, callback) => callback()
    })
    const rl = readline.createInterface(process.stdin, invisible, undefined, true)
    let cancelled = false
    let valueAnswer = ''
    rl.on('close', () => {
      process.stdout.write('\n')
      if (cancelled) return reject(inputError('cancelled'))
      return resolve(valueAnswer)
    })
    process.stdout.write(question)
    rl.question('', answer => {
      valueAnswer = answer
      rl.close()
    })
    rl.on('SIGINT', () => {
      cancelled = true
      rl.close()
    })
  })

export const getPaginationOptions = (cmd: Command): { limit: number, page: number } => {
  const { limit, page } = cmd.opts<{ limit: string, page: string }>()
  return {
    limit: parseInt(limit),
    page: parseInt(page)
  }
}

export const getYesOption = (cmd: Command): { yes: boolean } => {
  const opts = cmd.opts()
  return { yes: !!opts.yes }
}

export const limitOption = (description = 'items per page'): Option =>
  new Option('-l, --limit <n>', description).default('10')

export const pageOption = (description = 'page number'): Option =>
  new Option('-p, --page <n>', description).default('1')

export const yesOption = (description = 'do not ask for confirmation'): Option =>
  new Option('-y, --yes', description)
