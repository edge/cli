// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { homedir } from 'os'
import { sep } from 'path'

export type Config = {
  docker: Docker
  network: Network[]
  wallet: Wallet
}

type Docker = {
  socketPath: string
}

export type Network = {
  name: string
  blockchain: {
    baseURL: string
  }
  index: {
    baseURL: string
  }
}

type Wallet = {
  file: string
}

const config: Config = {
  docker: {
    socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
  },
  network: [
    {
      name: 'main',
      blockchain: {
        baseURL: 'https://api.xe.network'
      },
      index: {
        baseURL: 'https://index.xe.network'
      }
    },
    {
      name: 'test',
      blockchain: {
        baseURL: 'https://xe1.test.networkinternal.com'
      },
      index: {
        baseURL: 'https://index.test.networkinternal.com'
      }
    }
  ],
  wallet: {
    file: `${homedir}${sep}.xe-wallet.json`
  }
}

export default config

export const selectNetwork = (name: string): Network => {
  const network = config.network.find(n => n.name === name)
  if (network === undefined) throw new Error(`unknown network "${name}"`)
  return network
}
