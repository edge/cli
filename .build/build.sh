#/bin/bash
set -e

[ "${BUILD_TARGET}" = "" ] && echo "BUILD_TARGET required" && exit 1

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
  ${BUILD_IMAGE_NAME}
