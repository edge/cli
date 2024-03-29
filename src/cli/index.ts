// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as _debug from './debug'
import { Context } from '../main'

export * as color from './color'
export * as debug from './debug'
export * as docker from './docker'
export * as express from './express'
export * as memo from './memo'
export * as overwrite from './overwrite'
export * as pagination from './pagination'
export * as passphrase from './passphrase'
export * as privateKey from './privateKey'
export * as stake from './stake'
export * as verbose from './verbose'
export * as wallet from './wallet'
export * as yes from './yes'

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Global error handler.
 * Catches and cleanly prints any error that may arise from sub-commands.
 */
export const errorHandler =
  <T>(ctx: Context, f: (...args: any[]) => Promise<T>) =>
    async (...args: any[]): Promise<T|undefined> => {
      try {
        return await f(...args)
      }
      catch (err) {
        if (!isCancelledInput(err)) {
          const log = ctx.log('critical')
          const { debug } = _debug.read(ctx.parent)
          log.error(`${err}`, debug ? { err } : undefined)
        }
        process.exitCode = 1
      }
      return undefined
    }
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Helper to distinguish whether an error reflects cancelled input (from C-c). */
const isCancelledInput = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false
  return err.name === 'InputError' && err.message === 'cancelled'
}
