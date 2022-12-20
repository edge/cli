// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Writable } from 'stream'
import chalk from 'chalk'
import { namedError } from './helpers'
import readline from 'readline'

/** Input error. */
const inputError = namedError('InputError')

/**
 * Ask for input from the user.
 */
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

/**
 * Ask for a single-letter input from the user e.g. `y/n`
 */
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

/**
 * Ask for secure input from the user.
 * This prevents the input from being displayed.
 */
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

/**
 * Standard colours for log output.
 */
export const color = {
  context: chalk.gray,
  debug: chalk.blue,
  error: chalk.red,
  info: chalk.white,
  notice: chalk.green,
  success: chalk.green,
  warn: chalk.yellow
}
