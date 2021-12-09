// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

export type Config = {
  docker: Docker
}

type Docker = {
  dataVolume: string
  socketPath: string
}

const config: Config = {
  docker: {
    dataVolume: process.env.DOCKER_DATA_VOLUME || 'edge-device-data',
    socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
  }
}

export default config
