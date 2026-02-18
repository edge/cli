#!/bin/bash

set -e

BASE_URL="https://files.edge.network/cli"
NETWORK="${1:-mainnet}"
INSTALL_DIR="/usr/local/bin"

if [[ "$NETWORK" != "mainnet" && "$NETWORK" != "testnet" ]]; then
  echo "Usage: $0 [mainnet|testnet]" >&2
  exit 1
fi

if [[ "$NETWORK" == "mainnet" ]]; then
  BIN_NAME="edge"
else
  BIN_NAME="edgetest"
fi

# Detect OS
case "$(uname -s)" in
  Darwin)  os="macos" ;;
  Linux)   os="linux" ;;
  MINGW*|MSYS*|CYGWIN*)
    os="windows"
    ;;
  *)
    echo "Unsupported OS: $(uname -s)" >&2
    exit 1
    ;;
esac

# Detect architecture
case "$(uname -m)" in
  x86_64|amd64)   arch="x64" ;;
  arm64|aarch64)   arch="arm64" ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

# Detect Rosetta 2 on macOS
if [[ "$os" == "macos" && "$arch" == "x64" ]]; then
  if [[ "$(sysctl -n sysctl.proc_translated 2>/dev/null)" == "1" ]]; then
    arch="arm64"
  fi
fi

echo "Installing Edge CLI ($NETWORK) for $os/$arch..."

# Set up file extension and install path
ext=""
if [[ "$os" == "windows" ]]; then
  ext=".exe"
  INSTALL_DIR="$HOME/bin"
fi

binary_url="$BASE_URL/$NETWORK/$os/$arch/latest/${BIN_NAME}${ext}"
checksum_url="$BASE_URL/$NETWORK/$os/$arch/latest/checksum"
version_url="$BASE_URL/$NETWORK/$os/$arch/latest/version"

# Download to temp
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

echo "Downloading..."
if ! curl -fsSL -o "$tmp_dir/$BIN_NAME" "$binary_url"; then
  echo "Download failed. Check your network connection." >&2
  exit 1
fi

# Verify checksum
expected=$(curl -fsSL "$checksum_url")
if [[ "$os" == "macos" ]]; then
  actual=$(shasum -a 256 "$tmp_dir/$BIN_NAME" | cut -d' ' -f1)
else
  actual=$(sha256sum "$tmp_dir/$BIN_NAME" | cut -d' ' -f1)
fi

if [[ "$actual" != "$expected" ]]; then
  echo "Checksum verification failed" >&2
  echo "  Expected: $expected" >&2
  echo "  Got:      $actual" >&2
  exit 1
fi

# Get version for display
version=$(curl -fsSL "$version_url" 2>/dev/null || echo "unknown")

# Install
chmod +x "$tmp_dir/$BIN_NAME"
mkdir -p "$INSTALL_DIR"

if [[ -w "$INSTALL_DIR" ]]; then
  mv "$tmp_dir/$BIN_NAME" "$INSTALL_DIR/${BIN_NAME}${ext}"
else
  sudo mv "$tmp_dir/$BIN_NAME" "$INSTALL_DIR/${BIN_NAME}${ext}"
fi

echo ""
echo "Edge CLI v${version} ($NETWORK) installed to $INSTALL_DIR/${BIN_NAME}${ext}"
echo "Run '${BIN_NAME} --version' to verify."
