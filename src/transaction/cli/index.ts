// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import { Context } from '../../main'
import { command as list } from './list'
import { command as listPending } from './listPending'
import { command as send } from './send'

export const command = (ctx: Context): Command => {
  const cmd = new Command('transaction').alias('tx').description('manage transactions')
  cmd.addCommand(list(ctx))
  cmd.addCommand(listPending(ctx))
  cmd.addCommand(send(ctx))
  return cmd
}
