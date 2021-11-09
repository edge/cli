#!/bin/sh
# Copyright (C) 2021 Edge Network Technologies Limited
# Use of this source code is governed by a GNU GPL-style license
# that can be found in the LICENSE.md file. All rights reserved.

set -e

main() {
  declare -a PLATFORMS=("linux" "macos" "win")
  declare -a ARCHS=("x64" "arm64")

  # If network or version are not set, exit
  if [[ -z $NETWORK || -z $VERSION ]]; then
    echo "Usage: NETWORK=<network> VERSION=<version> ./entrypoint.sh"
    exit 1
  fi

  # Set filename to edge if network is mainnet otherwise set it to edgetest
  if [ $NETWORK ]; then
    FILENAME="edge"
  else
    FILENAME="edgetest"
  fi

  # Loop through platforms and then archs, copying files
  for platform in "${PLATFORMS[@]}"
  do
    for arch in "${ARCHS[@]}"
    do
      copyFile $platform $arch $VERSION $FILENAME
      copyFile $platform $arch latest $FILENAME
    done
  done
}

# $1 is platform, $2 is arch, $3 is version, $4 is filename
copyFile() {
  mkdir -p /mnt/fileserver/cli/$NETWORK/$1/$2/$3
  cp /cli/bin/edge-$1-$2 /mnt/fileserver/cli/$NETWORK/$1/$2/$3/$4
  chmod +x /mnt/fileserver/cli/$NETWORK/$1/$2/$3/$4
  echo $3 > /mnt/fileserver/cli/$NETWORK/$1/$2/$3/version
  sha256sum /mnt/fileserver/cli/$NETWORK/$1/$2/$3/$4 > /mnt/fileserver/cli/$NETWORK/$1/$2/$3/checksum
}

main "$@"; exit