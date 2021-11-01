// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import main from './main'

main(process.argv, {
  name: 'testnet',
  blockchain: {
    baseURL: 'https://xe1.test.networkinternal.com'
  },
  explorer: {
    baseURL: 'https://explorer.test.networkinternal.com'
  },
  index: {
    baseURL: 'https://index.test.networkinternal.com'
  }
})
