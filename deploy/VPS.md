# Chessito on an existing Docker VPS

Use the VPS's current HTTPS proxy. This deployment starts only Chessito and its
engines, adds no host port mappings, and does not change other Compose projects.
The image bundle requires Linux x86-64, Docker Engine and Compose with `--wait`.
Allow about 3 GB RAM for these containers plus capacity for the existing apps.

## Install

### From a GitHub checkout

Clone your repository into a private directory on the VPS. The source build
requires Docker only; Node.js runs in the builder container. Before starting:

1. Copy `deploy/vps.env.example` to `.env` and set its mode to 600. If you already
   have a private `.env`, add the VPS settings to it and preserve your login.
2. Set `CHESSITO_RELEASE` to an image tag for this checkout, such as `local`.
3. Set `CHESSITO_DOMAIN=chess.companyapps.xyz` and the existing proxy's Docker
   network name. Set a unique password of at least 16 characters locally in
   `.env`; `openssl rand -hex 24` can generate one. Keep this file out of Git.
4. Confirm the selected proxy network exists. Then build and start:

```sh
docker compose -p chessito -f compose.vps.yaml up -d --build --wait
```

The first engine build compiles pinned source and downloads neural networks,
so it takes longer than an app build. Later builds reuse Docker's cache. For
updates, make a backup before pulling changes/rebuilding; preserve `.env` and
the `chessito_chessito_data` volume. After startup, configure the existing proxy
and Cloudflare as below. These are manual deployment instructions; committing
or pushing to GitHub does not deploy the app.

### From a prebuilt image bundle

Copy and extract the release into a private directory such as `/opt/chessito`.
Keep that directory outside any web server's document root. On the VPS:

```sh
sha256sum -c SHA256SUMS
docker load -i images.tar.gz
bash ops.sh init chess.companyapps.xyz EXISTING_PROXY_NETWORK
bash ops.sh up
```

Replace the hostname and network. Inspect the existing proxy's attached Docker
networks to choose the right network. No new proxy is installed. The generated
`.env` contains your login password and has mode 600. Compose stores it in the
container environment, so Docker administrators can read it.

In the existing proxy, add a route for the hostname to **`http://chessito-web:3000`**.
Preserve the incoming Host header and allow at least 65 seconds for engine/coach
requests. Disable proxy/CDN caching for this hostname's private pages and APIs.
If `chessito-web` is already used, change `CHESSITO_PROXY_ALIAS` before starting.
The engines stay on Chessito's private network. The proxy can reach the app only.

Nginx Proxy Manager: create a Proxy Host with this domain, scheme `http`, forward
hostname `chessito-web`, port `3000`; assign a valid certificate and force SSL.
Caddy: add this host block to the existing managed configuration:

```caddyfile
chess.companyapps.xyz {
  reverse_proxy chessito-web:3000
}
```

For Traefik, add a router/service using the installation's existing entrypoint,
certificate resolver and Docker network. Those names must be inspected on the
VPS before configuration. Do not replace its global configuration.

## Cloudflare

Create a **proxied A record** for the chosen hostname pointing to the VPS's public
IPv4 address. Remove or correct an incompatible AAAA record for that hostname.
The proxy on the VPS must serve a valid, matching, unexpired origin certificate:
a public CA certificate or a Cloudflare Origin CA certificate. Use **Full
(strict)** encryption. An A record does not install a certificate on the VPS.
Avoid changing zone-wide settings that would break existing services; inspect
them first. A public certificate may need DNS validation if HTTP validation is
blocked by the existing firewall/proxy. Disable caching for the private app.

Official reference: https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/

Check the public HTTPS URL, sign in, play a move, import a small PGN, and confirm
settings survive a container restart. Install from Safari's Share menu or
Android's browser menu once HTTPS works. A remote hostname/certificate/phone
test still needs to be completed on your real infrastructure.

## Backups and updates

```sh
bash ops.sh backup
```

From a GitHub source checkout, use **`bash deploy/ops.sh backup`** instead. The
helper locates the repository root and uses the same `chessito` Compose project.
`bash deploy/ops.sh status` and `bash deploy/ops.sh logs` also work there.

This creates a consistent database, its encryption key and checksum manifest in
`backups/<timestamp>`. Copy backups to private storage outside the VPS. The
command does not automatically delete old backups; monitor available disk space.
For unattended backups, run it from the VPS's existing scheduler and monitor
failures. The database and key must always be kept together.

For a source update, take a backup, pull your chosen Git revision, rebuild using
the source commands above, and then run `bash deploy/ops.sh up`. The helper takes
another backup before replacing the running containers and waits for health.
Use a fresh `CHESSITO_RELEASE` tag for each release if you want to retain older
images for rollback.

For an image-bundle update, verify/load the new bundle, replace the deployment scripts/Compose
file, keep `.env` and `backups`, and set `CHESSITO_RELEASE` to the new RELEASE
value. Run `bash ops.sh up`; it backs up the running app before recreation and
waits for both containers to be healthy. Do not use `down -v`. Check the public
URL before removing old image tags. If startup fails, inspect logs and keep the
backup. An older image may not understand newer database migrations; a rollback
may need the matching pre-update database/key backup too.

To restore, first stop the app, preserve the current volume, verify all backup
checksums, and restore the matching SQLite database and key as UID/GID 1000 with
mode 600. Remove obsolete database `-wal` and `-shm` files while the app is stopped.
Restart and verify login, games and provider settings. Do not overwrite live
database files. This release does not automate destructive restores.

Local Windows games are separate from the VPS database. Migrate them using a
consistent database/key backup over SSH, or export/import PGNs. PGN transfer
preserves games but provider keys/settings need configuring again.
