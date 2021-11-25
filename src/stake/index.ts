import * as xe from '@edge/xe-utils'
import { namedError } from '../helpers'

export const ambiguousIDError = namedError('AmbiguousIDError')

export const findOne = (stakes: xe.stake.Stakes, id: string): xe.stake.Stake => {
  if (id.length < 3) throw new Error('stake ID must be at least 3 characters')
  const ss = Object.values(stakes).filter(s => s.id.slice(0, id.length) === id)
  if (ss.length === 0) throw new Error(`stake ${id} not found`)
  if (ss.length > 1) {
    const matchIDs = ss.map(s => s.id.slice(0, id.length + 4))
    throw ambiguousIDError(`ambiguous ID matches ${matchIDs.join(', ')}`)
  }
  return ss[0]
}

export const precedence = ['stargate', 'gateway', 'host'].reduce((o, v, i) => {
  o[v] = i
  return o
}, {} as Record<string, number>)

export const types = ['host', 'gateway', 'stargate']
