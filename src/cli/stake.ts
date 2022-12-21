// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Command } from 'commander'
import { statuses, types } from '../stake'

/** Stake options. */
export type StakeOption = {
  /** Stake ID. */
  stake?: string
}

/** Stake status options. */
export type StakeStatusOption = {
  /** Stake status. */
  stakeStatus?: string
}

/** Stake type options. */
export type StakeTypeOption = {
  /** Stake type. */
  stakeType?: string
}

/** Configure a command with stake options. */
export const configure = (cmd: Command, description = 'stake ID'): void => {
  cmd.option('-s, --stake <id>', description)
}

/** Configure a command with stake status options. */
export const configureStatus = (cmd: Command): void => {
  cmd.option('-s, --stake-status <status>', 'stake status')
}

/** Configure a command with stake type options. */
export const configureType = (cmd: Command): void => {
  cmd.option('-t, --stake-type <id>', 'stake type')
}

/** Read stake options from a command. */
export const read = (cmd: Command): StakeOption => {
  const opts = cmd.opts()
  return { stake: opts.stake }
}

/** Read stake status options from a command. */
export const readStatus = (cmd: Command): StakeStatusOption => {
  const opts = cmd.opts()
  if (opts.stakeStatus !== undefined) {
    if (!statuses.includes(opts.stakeStatus)) throw new Error('invalid stake status')
  }
  return { stakeStatus: opts.stakeStatus }
}

/** Read stake type options from a command. */
export const readType = (cmd: Command): StakeTypeOption => {
  const opts = cmd.opts()
  if (opts.stakeType !== undefined) {
    if (!types.includes(opts.stakeType)) throw new Error('invalid stake type')
  }
  return { stakeType: opts.stakeType }
}
