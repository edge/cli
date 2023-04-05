// Copyright (C) 2023 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as cli from '../../cli'
import * as repl from '../../repl'
import { Command } from 'commander'
import { Context } from '../../main'
import { checkVersionHandler } from '../../update/cli'
import config from '../../config'
import { errorHandler } from '../../cli'

/**
 * Display device information.
 */
export const action = (ctx: Context) => async (): Promise<void> => {
  const opts = {
    ...cli.docker.readAllEnv(ctx.parent)
  }

  repl.raw(opts.env.join('\n'))
}

export const command = (ctx: Context): Command => {
  const cmd = new Command('env').description('display environment variables').addHelpText('after', help(ctx))
  cli.docker.configurePrefix(cmd)
  cmd.action(errorHandler(ctx, checkVersionHandler(ctx, action({ ...ctx, cmd }))))
  return cmd
}

const help = ({ network }: Context) => repl.help(`
This command displays environment variables passed implicitly from your host machine to the device when using '${network.appName} device start'.

Environment variables are managed in ${config.envFile}. To change the location of your environment file, prefix your CLI usage with 'ENV_FILE=<path>'.

You can also override the file path by using '${network.appName} device start --env-file=<path>'.
`)
