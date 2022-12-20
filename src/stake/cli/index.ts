// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as xeUtils from '@edge/xe-utils'
import { Command } from 'commander'
import { Context } from '../..'
import { XEClient } from '../../api/xe'
import { command as create } from './create'
import { command as info } from './info'
import { command as list } from './list'
import { command as release } from './release'
import { command as unlock } from './unlock'

/**
 * Wrapper for xe.vars; throws the original error in --debug CLI, otherwise generic error message.
 */
export const xeVars = async (xeClient: XEClient, debug: boolean): Promise<xeUtils.Vars> => {
  try {
    return await xeClient.vars()
  }
  catch (err) {
    if (debug) throw err
    throw new Error('Staking is currently unavailable. Please try again later.')
  }
}

/**
 * Configure `stake` commands with root context.
 */
export const command = (ctx: Context): Command => {
  const cmd = new Command('stake').description('manage stakes')
  cmd.addCommand(create(ctx))
  cmd.addCommand(info(ctx))
  cmd.addCommand(list(ctx))
  cmd.addCommand(release(ctx))
  cmd.addCommand(unlock(ctx))
  return cmd
}
