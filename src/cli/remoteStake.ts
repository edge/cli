// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'

/** remoteStake options. */
export type remoteStakeOption = {
  /** Use CLI with remoteStake for device token staking method. */
  remoteStake?: string
}

/** Configure a command with remoteStake options. */
export const configureRemoteStake = (cmd: Command, description = 'use a remote stake for your node (device token staking method)'): void => {
  cmd.option('--remote-stake <remoteStake>', description)
}

/** Read remoteStake options from a command. */
export const readRemoteStake = (cmd: Command): remoteStakeOption => {
  const opts = cmd.opts()
  return { remoteStake: opts.remoteStake }

}
