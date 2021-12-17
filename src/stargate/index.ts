// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Network } from '../'
import superagent from 'superagent'

export const getServiceVersion = async (network: Network, name: string): Promise<string> => {
  const res = await superagent.get(network.stargate.serviceURL(name))
  const data = res.body as { name: string, version: string }
  return data.version
}
