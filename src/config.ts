// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import dotenv from 'dotenv'

dotenv.config()

export default {
  blockchain: {
    defaultTimeout: parseInt(process.env.BLOCKCHAIN_TIMEOUT || '10') * 1000
  },
  docker: {
    dataVolume: process.env.DOCKER_DATA_VOLUME || 'edge-device-data',
    edgeRegistry: {
      address: 'registry.edge.network',
      defaultImageTag: 'latest',
      auth: {
        username: process.env.EDGE_REGISTRY_USERNAME || '',
        password: process.env.EDGE_REGISTRY_PASSWORD || ''
      }
    }
  },
  id: {
    minEntryLength: 3,
    shortLength: 12
  },
  index: {
    defaultTimeout: parseInt(process.env.INDEX_TIMEOUT || '10') * 1000
  }
}
