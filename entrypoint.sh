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
  if [ $NETWORK = "mainnet" ]; then
    FILENAME="edge"
  else
    FILENAME="edgetest"
  fi

  # Loop through platforms and then archs, copying files,
  # except for windows/arm64, which we skip
  for platform in "${PLATFORMS[@]}"
  do
    for arch in "${ARCHS[@]}"
    do
      DEST="${FILENAME}"
      SRC="edge-${platform}-${arch}"

      # Append .exe to the filename if windows and skip
      # win/arm64 until we are able to support it
      if [ $platform = "win" ]; then
        if [ $arch = "arm64" ]; then
          continue
        fi
        DEST="${DEST}.exe"
        SRC="${SRC}.exe"
      fi

      copyFile $platform $arch $VERSION $SRC $DEST
      copyFile $platform $arch latest $SRC $DEST

      # If mac, sign the file
      # TODO
    done
  done
}

# $1 is platform, $2 is arch, $3 is version, $4 is source file, $5 is dest file
copyFile() {
  mkdir -p /mnt/fileserver/cli/$NETWORK/$1/$2/$3
  cp /cli/bin/$4 /mnt/fileserver/cli/$NETWORK/$1/$2/$3/$5
  chmod +x /mnt/fileserver/cli/$NETWORK/$1/$2/$3/$5
  echo $3 > /mnt/fileserver/cli/$NETWORK/$1/$2/$3/version
  sha256sum /mnt/fileserver/cli/$NETWORK/$1/$2/$3/$5 > /mnt/fileserver/cli/$NETWORK/$1/$2/$3/checksum
}

main "$@"; exit