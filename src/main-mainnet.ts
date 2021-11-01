// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import main from './main'

main(process.argv, {
  name: 'mainnet',
  blockchain: {
    baseURL: 'https://api.xe.network'
  },
  explorer: {
    baseURL: 'https://xe.network'
  },
  index: {
    baseURL: 'https://index.xe.network'
  }
})