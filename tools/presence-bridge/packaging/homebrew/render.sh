#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Fills in the Homebrew formula template for one release.
#
#   render.sh <version> <source archive URL> [local copy of the archive]
#
# Without a local copy the archive is downloaded to work out its checksum. Prints the formula.
set -euo pipefail
version=$1 url=$2 file=${3:-}
# Both go into a sed command and a Ruby file: only what a release can really have.
if ! [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "render.sh: version $version is not X.Y.Z" >&2
  exit 1
fi
# A release's archive on GitHub, or (for the CI's test install) a plain local file.
if ! [[ $url =~ ^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/archive/refs/tags/tools/presence-bridge/v[0-9]+\.[0-9]+\.[0-9]+\.tar\.gz$ ||
  $url =~ ^file:///[A-Za-z0-9._/-]+$ ]]; then
  echo "render.sh: $url is not a release archive URL or a local file" >&2
  exit 1
fi
if [ -z "$file" ]; then
  file=$(mktemp)
  trap 'rm -f "$file"' EXIT
  curl -fsSL -o "$file" "$url"
fi
sum=$( (sha256sum "$file" 2>/dev/null || shasum -a 256 "$file") | cut -d' ' -f1)
sed -e "s|@URL@|$url|" -e "s|@VERSION@|$version|" -e "s|@SHA256@|$sum|" \
  "$(dirname "$0")/sleazeburg-presence.rb.in"
