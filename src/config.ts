// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import dotenv from 'dotenv'

dotenv.config()

/**
 * Global configuration.
 * Some properties can be specified in the shell environment.
 * However, it's normally best to leave these alone unless debugging or Edge Core Team advises changes.
 */
export default {
  address: {
    shortLength: 9
  },
  blockchain: {
    defaultTimeout: parseInt(process.env.BLOCKCHAIN_TIMEOUT || '10') * 1000
  },
  docker: {
    dataVolume: process.env.DOCKER_DATA_VOLUME || 'edge-device-data',
    directReadWrite: process.env.DOCKER_DIRECT_RW === 'true',
    edgeRegistry: {
      address: 'registry.edge.network',
      defaultImageTag: 'latest',
      auth: {
        username: process.env.EDGE_REGISTRY_USERNAME || '',
        password: process.env.EDGE_REGISTRY_PASSWORD || ''
      }
    }
  },
  hash: {
    shortLength: 8
  },
  id: {
    minEntryLength: 3,
    shortLength: 12
  },
  index: {
    defaultTimeout: parseInt(process.env.INDEX_TIMEOUT || '10') * 1000
  },
  signature: {
    shortLength: 12
  }
}
