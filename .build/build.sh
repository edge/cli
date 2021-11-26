#!/bin/bash
# Copyright (C) 2021 Edge Network Technologies Limited
# Use of this source code is governed by a GNU GPL-style license
# that can be found in the LICENSE.md file. All rights reserved.

set -e

[ "${BUILD_TARGET}" = "" ] && echo "BUILD_TARGET required" && exit 1
[ "${NETWORK}" = "" ] && echo "NETWORK required" && exit 1

BIN_NAME=edge
if [ "${NETWORK}" = "testnet" ]; then
  BIN_NAME=edgetest
fi

[ "${ROOT}" = "" ] && ROOT=${PWD}

BUILD_IMAGE_NAME=registry.edge.network/edge/cli-build:${BUILD_TARGET}

docker build ${ROOT} \
  -f .build/Dockerfile \
  -t ${BUILD_IMAGE_NAME}

[ "${PKG_CACHE_PATH}" = "" ] && PKG_CACHE_PATH=${HOME}/.pkg-cache

docker run --rm -ti \
  -v ${PKG_CACHE_PATH}:/root/.pkg-cache \
  -v ${ROOT}/bin:/build/bin \
  -v ${ROOT}/src:/build/src:ro \
  -e BUILD_TARGET=${BUILD_TARGET} \
  -e NETWORK=${NETWORK} \
  -e BIN_NAME=${BIN_NAME} \
  ${BUILD_IMAGE_NAME}
