// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as repl from '../../repl'
import { Command } from 'commander'
import { Context } from '../../main'
import { command as check } from './check'
import { command as update } from './update'
import { cachedLatestVersion, currentVersion } from '..'

/**
 * Handler to check for any CLI updates.
 * This wraps any command to provide a background poll capability, displaying a CTA if an update is available.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const checkVersionHandler =
  <T>(ctx: Context, f: (...args: any[]) => Promise<T>) =>
    async (...args: any[]): Promise<T|undefined> => {
      const result = await f(...args)

      const opts = {
        ...cli.debug.read(ctx.parent),
        ...cli.color.read(ctx.parent)
      }

      const log = ctx.log()
      try {
        const cv = currentVersion()
        const lv = await cachedLatestVersion(ctx)

        if (lv.compare(cv) > 0) {
          const txt = `
          A new version of Edge CLI is available (v${lv}).
          Please run '${ctx.network.appName} update' to update to the latest version.
          `
          repl.echon(opts.noColor ? txt : repl.color.notice(txt))
        }
      }
      catch (err) {
        if (opts.debug) log.error('Error checking latest version', { err })
        else log.warn('There was a problem reaching the update server. Please check your network connectivity.')
      }

      return result
    }

export const command = (ctx: Context, argv: string[]): Command => {
  const cmd = update(ctx, argv)
  cmd.addCommand(check(ctx))
  return cmd
}
