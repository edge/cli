// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as repl from '../../repl'
import { Command } from 'commander'
import { Context } from '../../main'
import { errorHandler } from '../../cli'
import { currentVersion, latestVersion } from '..'

/** Check Edge Network Files for a newer version of CLI. */
export const action = (ctx: Context) => async (): Promise<void> => {
  const cv = currentVersion()
  const lv = await latestVersion(ctx)
  if (lv.compare(cv) > 0) {
    repl.echon(`
    Current Edge CLI version: v${cv}

    A new version of Edge CLI is available (v${lv}).
    Run '${ctx.network.appName} update' to update to the latest version.
    `)
  }
  else repl.echo('Edge CLI is up to date.')
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('check').description('check for updates').addHelpText('after', help)
  cmd.action(errorHandler(ctx, action(ctx)))
  return cmd
}

const help = repl.help(`
Check for an update to Edge CLI.
`)
