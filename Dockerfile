# Copyright (C) 2021 Edge Network Technologies Limited
# Use of this source code is governed by a GNU GPL-style license
# that can be found in the LICENSE.md file. All rights reserved.

FROM node:lts AS build

ARG NETWORK=mainnet
ARG NODE=node14

WORKDIR /cli

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source files in
COPY src ./src
COPY tsconfig.json ./
COPY .eslint* ./

# Run linting & tests, then build app
RUN npm run lint && npm run test
RUN npm run $NETWORK:build:src

# Using pkg build packages for all platforms and architectures
RUN npx pkg out/src/main-$NETWORK.js \
  --target $NODE-linux-x64,$NODE-linux-arm64,$NODE-macos-x64,$NODE-macos-arm64,$NODE-win-x64,$NODE-win-arm64 \
  --output /cli/bin/edge
