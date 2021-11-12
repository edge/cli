// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { homedir } from 'os'
import main from './main'
import { sep } from 'path'

main(process.argv, {
  name: 'testnet',
  blockchain: {
    baseURL: 'https://xe1.test.network'
  },
  explorer: {
    baseURL: 'https://test.network'
  },
  files: {
    latestBuildURL: (os, arch, ext) => `https://files.edge.network/cli/testnet/${os}/${arch}/latest/edgetest${ext}`,
    latestChecksumURL: (os, arch) => `https://files.edge.network/cli/testnet/${os}/${arch}/latest/checksum`,
    latestVersionURL: (os, arch) => `https://files.edge.network/cli/testnet/${os}/${arch}/latest/version`
  },
  index: {
    baseURL: 'https://index.test.network'
  },
  wallet: {
    defaultFile: `${homedir}${sep}.edge${sep}wallet${sep}testnet.json`
  }
})
