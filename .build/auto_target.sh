#!/bin/bash
set -e

if [ "${BUILD_TARGET}" != "" ]; then
  echo -n ${BUILD_TARGET}
  exit
elif [ "$(which sw_vers)" != "" ]; then
  echo -n macos-x64
  exit
fi
