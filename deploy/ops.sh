#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if test ! -f compose.vps.yaml && test -f ../compose.vps.yaml; then cd ..; fi
root=$(pwd -P)
project=${CHESSITO_PROJECT:-chessito}
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || { echo 'Invalid Compose project name.' >&2; exit 1; }
dc() { docker compose --project-name "$project" --env-file "$root/.env" -f "$root/compose.vps.yaml" "$@"; }
require_config() { test -f .env || { echo 'Run: bash ops.sh init HOSTNAME PROXY_NETWORK' >&2; exit 1; }; }
backup_app() {
  local container stamp destination
  container=$(dc ps -q chessito)
  test -n "$container" || { echo 'Chessito must be running to take a consistent backup.' >&2; return 1; }
  # SQLite's online backup includes committed WAL data. Copy the matching key too.
  stamp=$(docker exec "$container" node docker/backup.mjs --print-name)
  [[ "$stamp" =~ ^[0-9TZ-]+$ ]] || { echo 'Invalid backup directory returned.' >&2; return 1; }
  destination="$root/backups/$stamp"
  mkdir -p -- "$root/backups"
  test ! -e "$destination" || { echo 'Backup already exists.' >&2; return 1; }
  docker cp "$container:/data/backups/$stamp" "$destination"
  chmod -R go-rwx -- "$destination"
  echo "Backup saved: $destination"
}
case "${1:-help}" in
  init)
    test ! -e .env || { echo 'Existing .env kept.'; exit 0; }
    domain=${2:?Supply the Chessito hostname}; network=${3:?Supply the existing proxy network}
    [[ "$domain" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ && "$domain" == *.* ]] || { echo 'Invalid hostname.' >&2; exit 1; }
    [[ "$network" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || { echo 'Invalid network name.' >&2; exit 1; }
    docker network inspect "$network" >/dev/null
    test -f RELEASE || { echo 'For a source checkout, configure .env from deploy/vps.env.example and build the images as described in deploy/VPS.md.' >&2; exit 1; }
    release=$(cat RELEASE)
    [[ "$release" =~ ^[A-Za-z0-9_.-]+$ ]] || exit 1
    password=$(docker run --rm --network none --entrypoint node "chessito-app:$release" -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('hex'))")
    printf 'CHESSITO_RELEASE=%s\nCHESSITO_DOMAIN=%s\nCHESSITO_PROXY_NETWORK=%s\nCHESSITO_PROXY_ALIAS=chessito-web\nCHESSITO_USERNAME=david\nCHESSITO_PASSWORD=%s\n' "$release" "$domain" "$network" "$password" > .env
    unset password
    echo 'Created private .env. Read the generated password locally to sign in.'
    ;;
  up)
    require_config
    [[ "$(docker info --format '{{.OSType}}/{{.Architecture}}')" == linux/x86_64 ]] || { echo 'This image bundle requires Linux x86-64.' >&2; exit 1; }
    dc config --quiet
    if test -n "$(dc ps -q chessito)"; then backup_app; fi
    dc up -d --no-build --pull never --wait --wait-timeout 180
    dc ps
    ;;
  backup) require_config; backup_app ;;
  status) require_config; dc ps ;;
  logs) require_config; dc logs --tail 100 ;;
  stop) require_config; dc stop ;;
  *) echo 'Usage: bash ops.sh init HOSTNAME PROXY_NETWORK | up | backup | status | logs | stop' ;;
esac
