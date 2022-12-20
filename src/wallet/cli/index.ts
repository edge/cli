// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import { Context } from '../..'
import { command as balance } from './balance'
import { command as create } from './create'
import { command as forget } from './forget'
import { command as info } from './info'
import { command as restore } from './restore'

/** Create wallet commands. */
export const command = (ctx: Context): Command => {
  const cmd = new Command('wallet').description('manage wallet')
  cmd.addCommand(balance(ctx))
  cmd.addCommand(create(ctx))
  cmd.addCommand(forget(ctx))
  cmd.addCommand(info(ctx))
  cmd.addCommand(restore(ctx))
  return cmd
}
