#!/bin/sh
# Copyright (C) 2021 Edge Network Technologies Limited
# Use of this source code is governed by a GNU GPL-style license
# that can be found in the LICENSE.md file. All rights reserved.

# This script is used in the final stage of the build & deploy
# process. It runs on the final image and unpacks the contents
# into the fileserver volume, updating versions and checksums.

set -e

main() {
  declare -a PLATFORMS=("linux" "macos" "windows")
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

  # Loop through platforms and archs
  for platform in "${PLATFORMS[@]}"
  do
    for arch in "${ARCHS[@]}"
    do
      DEST="${FILENAME}"
      SRC="edge-${platform}-${arch}"

      # Append .exe to the filename if windows
      if [ $platform = "windows" ]; then
        DEST="${DEST}.exe"
        SRC="${SRC}.exe"
      fi

      # Here we ensure the version directory exists, then copy the binary into it renaming it to the correct name,
      # then update the version file with the correct version, generate a checksum and update the checksum file,
      # before finally removing and updating the latest directory to point to the correct version
      mkdir -p /mnt/fileserver/cli/$NETWORK/$platform/$arch/$VERSION
      cp /cli/bin/$SRC /mnt/fileserver/cli/$NETWORK/$platform/$arch/$VERSION/$DEST
      echo $VERSION > /mnt/fileserver/cli/$NETWORK/$platform/$arch/$VERSION/version
      sha256sum /mnt/fileserver/cli/$NETWORK/$platform/$arch/$VERSION/$DEST | head -c 64 > /mnt/fileserver/cli/$NETWORK/$platform/$arch/$VERSION/checksum
      rm -rf /mnt/fileserver/cli/$NETWORK/$platform/$arch/latest
      cp -r /mnt/fileserver/cli/$NETWORK/$platform/$arch/$VERSION /mnt/fileserver/cli/$NETWORK/$platform/$arch/latest
    done
  done
}

main "$@"; exit
