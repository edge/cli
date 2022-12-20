// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from './cli'
import { Context } from '.'
import { Writable } from 'stream'
import chalk from 'chalk'
import { color } from './repl'
import { Adaptor, Log, LogLevel } from '@edge/log'
import { stderr, stdout } from 'process'

/**
 * Simple logging adapter to print customised output for CLI.
 * This is similar to the `StdioAdaptor` in `@edge/log` but omits timestamps and pretty-prints context data.
 */
export class SimpleAdapter implements Adaptor {
  private useColors: boolean
  private out: Writable
  private errOut: Writable

  constructor(useColors = true, useStderr = false) {
    this.useColors = useColors
    this.out = stdout
    this.errOut = useStderr ? stderr : stdout
  }

  debug(log: Log, message: string, context?: Record<string, unknown>): void {
    this.write(LogLevel.Debug, color.debug, message, log.name, context)
  }

  info(log: Log, message: string, context?: Record<string, unknown>): void {
    this.write(LogLevel.Info, color.info, message, log.name, context)
  }

  warn(log: Log, message: string, context?: Record<string, unknown>): void {
    this.write(LogLevel.Warn, color.warn, message, log.name, context)
  }

  error(log: Log, message: string, context?: Record<string, unknown>): void {
    this.write(LogLevel.Error, color.error, message, log.name, context)
  }

  private write(
    level: LogLevel,
    messageColor: chalk.ChalkFunction,
    message: string,
    name?: string,
    context?: Record<string, unknown>
  ): void {
    const nameText = name ? `[${name}]` : ''
    const messageText = this.useColors ? messageColor(message) : message

    let contextText = context ? JSON.stringify(context, undefined, 2) : ''
    contextText = contextText.length && this.useColors ? color.context(contextText) : contextText

    const outputText = [nameText, messageText, contextText].filter(s => s.length > 0).join(' ') + '\n'

    if (level === LogLevel.Error) this.errOut.write(outputText)
    else this.out.write(outputText)
  }
}

export const createLogger = ({ parent }: Pick<Context, 'parent'>, name?: string): Log => {
  const log = new Log(name)

  const { debug, noColor } = {
    ...cli.debug.read(parent),
    ...cli.color.read(parent)
  }

  log.use(new SimpleAdapter(!noColor, true))

  if (debug) log.setLogLevel(LogLevel.Debug)
  else log.setLogLevel(LogLevel.Warn)

  return log
}
