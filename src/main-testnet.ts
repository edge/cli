// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import main from './main'

main(process.argv, {
  name: 'testnet',
  blockchain: {
    baseURL: 'https://xe1.test.network'
  },
  explorer: {
    baseURL: 'https://test.network'
  },
  files: {
    latestBuildURL: (os, arch) => `https://files.edge.network/cli/testnet/${os}/${arch}/latest/edge-test`,
    latestChecksumURL: (os, arch) => `https://files.edge.network/cli/testnet/${os}/${arch}/latest/checksum`,
    latestVersionURL: (os, arch) => `https://files.edge.network/cli/testnet/${os}/${arch}/latest/version`
  },
  index: {
    baseURL: 'https://index.test.network'
  }
})
