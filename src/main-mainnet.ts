// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import config from './config'
import { homedir } from 'os'
import main from './main'
import { sep } from 'path'

main(process.argv, {
  appName: 'edge',
  name: 'mainnet',
  blockchain: {
    baseURL: 'https://api.xe.network'
  },
  explorer: {
    baseURL: 'https://xe.network'
  },
  files: {
    latestBuildURL: (os, arch, ext) => `https://files.edge.network/cli/mainnet/${os}/${arch}/latest/edge${ext}`,
    latestChecksumURL: (os, arch) => `https://files.edge.network/cli/mainnet/${os}/${arch}/latest/checksum`,
    latestVersionURL: (os, arch) => `https://files.edge.network/cli/mainnet/${os}/${arch}/latest/version`
  },
  flags: {
    onboarding: true
  },
  index: {
    baseURL: 'https://index.xe.network'
  },
  registry: {
    imageName: (app, arch) => `${config.docker.edgeRegistry.address}/${app}/mainnet-${arch}`
  },
  stargate: {
    serviceURL: app => `https://stargate.edge.network/services/${app}`
  },
  wallet: {
    defaultFile: `${homedir}${sep}.edge${sep}wallet${sep}mainnet.json`
  }
})
