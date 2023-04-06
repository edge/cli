// Copyright (C) 2022 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import config from './config'
import { homedir } from 'os'
import main from './main'
import { sep } from 'path'

/**
 * Start testnet CLI.
 */
main(process.argv, {
  appName: 'edgetest',
  name: 'testnet',
  blockchain: {
    host: 'https://xe1.test.network'
  },
  explorer: {
    host: 'https://test.network'
  },
  files: {
    latestBuildURL: (os, arch, ext) => `https://files.edge.network/cli/testnet/${os}/${arch}/latest/edgetest${ext}`,
    latestChecksumURL: (os, arch) => `https://files.edge.network/cli/testnet/${os}/${arch}/latest/checksum`,
    latestVersionURL: (os, arch) => `https://files.edge.network/cli/testnet/${os}/${arch}/latest/version`
  },
  flags: {
    onboarding: true
  },
  index: {
    host: 'https://index.test.network'
  },
  registry: {
    imageName: (app, arch) => `${config.docker.registry.address}/${app}/testnet-${arch}`
  },
  stargate: {
    host: 'https://stargate.test.network'
  },
  wallet: {
    defaultFile: `${homedir}${sep}.edge${sep}wallet${sep}testnet.json`
  }
})
