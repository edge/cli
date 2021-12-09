#!/bin/bash
# Copyright (C) 2021 Edge Network Technologies Limited
# Use of this source code is governed by a GNU GPL-style license
# that can be found in the LICENSE.md file. All rights reserved.

set -e

if [ "${BUILD_TARGET}" != "" ]; then
  echo -n ${BUILD_TARGET}
  exit
elif [ "$(which sw_vers)" != "" ]; then
  echo -n macos-x64
  exit
fi
