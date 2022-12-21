// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Writable } from 'stream'
import chalk from 'chalk'
import { namedError } from './helpers'
import readline from 'readline'

export type FormatOptions = {
  /** Automatically strip indentation, aligning each line to the left. */
  align: boolean
  /** Strip empty lines from end of input. */
  stripEnd: boolean
  /** Strip empty lines from start of input. */
  stripStart: boolean
}

const defaultFormatOptions: FormatOptions = {
  align: true,
  stripEnd: true,
  stripStart: true
}

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
    rl.question(`${question} `, answer => {
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
  let answer = await ask(`${question} [${allowChars}]`)
  while (!allow.includes(answer)) {
    echo(`Please enter ${allow.slice(0, allow.length-1).join(', ')} or ${allow[allow.length-1]}.`)
    answer = await ask(`${question} [${allowChars}]`)
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
    process.stdout.write(`${question} `)
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

/**
 * Format and print a text block.
 * Empty lines at the end of the block are preserved, and an additional newline is appended.
 */
export const echo = (txt: string): void => {
  process.stdout.write(fmt(`${txt}\n`, { stripEnd: false }))
}

/**
 * Format and print a text block.
 * Empty lines at the end of the block are preserved.
 */
export const echon = (txt: string): void => {
  process.stdout.write(fmt(txt, { stripEnd: false }))
}

/**
 * Format a text block (which can be multi-line) for proper presentation in REPL.
 *
 * Options can be passed in the second argument to control specific directives.
 * By default:
 *   - Empty lines at the start and end of the text block are removed
 *   - All lines are stripped of indentation based on the indentation of the first line
 */
export const fmt = (txt: string, opts?: Partial<FormatOptions>): string => {
  opts = { ...defaultFormatOptions, ...opts }
  let parts = txt.split('\n')
  if (opts.stripStart) {
    const firstPart = parts.findIndex(p => p.trim().length > 0)
    parts = parts.slice(firstPart)
  }
  if (opts.align) {
    const indent = parts[0].match(/^ */)?.[0].length || 0
    parts = parts.map(p => p.slice(indent))
  }
  if (opts.stripEnd) {
    const lastPart = parts.map(p => p).reverse().findIndex(p => p.trim().length > 0)
    parts = parts.slice(0, parts.length - lastPart)
  }
  return parts.join('\n')
}

/** Format help text for optimal presentation. */
export const help = (txt: string): string => `\n${fmt(txt)}`

/** Print an empty newline. */
export const nl = (): void => {
  process.stdout.write('\n')
}

/**
 * Print raw output without formatting.
 * An additional newline is appended.
 */
export const raw = (txt: string): void => {
  process.stdout.write(`${txt}\n`)
}

/** Print raw output without formatting. */
export const rawn = (txt: string): void => {
  process.stdout.write(txt)
}
