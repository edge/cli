// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import * as xe from '@edge/xe-utils'
import config from '../config'
import { namedError } from '../helpers'

/** Ambiguous ID error. */
export const ambiguousIDError = namedError('AmbiguousIDError')

/** Check whether a stake can be assigned to a device. */
export const canAssign = (stake: xe.stake.Stake): boolean => {
  if (stake.released) return false
  if (stake.unlockRequested) return false
  return true
}

/**
 * Find a single stake from a list based on a partial or full ID.
 *
 * If a partial ID is particularly short and the host wallet has a lot of stakes, there may be multiple matches.
 * In this instance, an AmbiguousIDError is thrown and the user should be prompted to try again with a longer input.
 */
export const findOne = (stakes: xe.stake.Stakes, id: string): xe.stake.Stake => {
  if (id.length < config.id.minEntryLength) throw new Error('stake ID must be at least 3 characters')
  const ss = Object.values(stakes).filter(s => s.id.slice(0, id.length) === id)
  if (ss.length === 0) throw new Error(`stake ${id} not found`)
  if (ss.length > 1) {
    const matchIDs = ss.map(s => s.id.slice(0, id.length + 4))
    throw ambiguousIDError(`ambiguous ID matches ${matchIDs.join(', ')}`)
  }
  return ss[0]
}

/**
 * Map of node types to precedence represented by a number.
 * This can be used to sort nodes, stakes etc. by node type.
 */
export const precedence = ['stargate', 'gateway', 'host', 'governance'].reduce((o, v, i) => {
  o[v] = i
  return o
}, {} as Record<string, number>)

/**
 * Function to `sort()` by precedence, which sub-sorts by created timestamp for the same node type.
 */
export const byPrecedence = (a: xe.stake.Stake, b: xe.stake.Stake): number => {
  const posDiff = precedence[a.type] - precedence[b.type]
  return posDiff !== 0 ? posDiff : a.created - b.created
}

/** Simple list of node types. */
export const types = ['host', 'gateway', 'stargate']
