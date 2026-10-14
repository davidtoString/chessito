#!/usr/bin/env bash
set -euo pipefail
destination=${1:?Supply the output archive path}
release=${2:?Supply the release tag}
[[ "$release" =~ ^[A-Za-z0-9_.-]+$ ]] || exit 1
docker save "chessito-app:$release" "chessito-engines:$release" | gzip -1 > "$destination.tmp"
mv -- "$destination.tmp" "$destination"
