# Chessito

A private chess coaching web app for a beginner. Docker runs an optimized Next.js standalone server with SQLite. Browser Stockfish 18 Lite checks moves and reviews games. The interface supports phones, light/dark/system appearance, original vector pieces, and installation as a web app.

## Deploy with Docker on your VPS

The root `Dockerfile` builds the app; `engines/Dockerfile` builds its chess engine
service. No Node.js installation is required on the VPS. With an existing Docker
reverse proxy, clone this repository and run:

```sh
cp deploy/vps.env.example .env
chmod 600 .env
```

Edit `.env`: set `CHESSITO_RELEASE=local`, your existing proxy's Docker network,
`CHESSITO_DOMAIN=chess.companyapps.xyz`, and a unique login password of at least
16 characters. Generate a password locally with `openssl rand -hex 24`.

```sh
docker compose -p chessito -f compose.vps.yaml up -d --build --wait
docker compose -p chessito -f compose.vps.yaml ps
```

Route your existing HTTPS proxy to `http://chessito-web:3000`. Both containers
have health checks, and games/settings persist in a Docker volume. The first
engine build downloads models and compiles engines. This deployment requires
Linux x86-64 and about 3 GB RAM available for Chessito. See [VPS instructions](deploy/VPS.md)
for HTTPS, Cloudflare, backups and prebuilt-image installation.

**Include all source files when committing:** `git add -A` includes the Docker
files and application changes; `.env`, private game data and build bundles are
excluded. Run `npm run check:repository` before committing.

## GitHub and later VPS deployment

The intended hostname is **`chess.companyapps.xyz`**. No VPS deployment or DNS
change is performed by this repository's GitHub workflow. Pushes and pull
requests run unit tests, TypeScript checks, the production build, dependency
audit and Docker configuration validation. The workflow needs no VPS, Cloudflare
or LLM credentials. Actions are pinned to commit hashes; see the upstream
[checkout](https://github.com/actions/checkout) and
[setup-node](https://github.com/actions/setup-node) documentation.

Before committing, run `npm run check:repository`. Commit the Dockerfiles,
Compose files, migrations, source, tests and lockfile. `.env` files, databases,
encryption keys, PGN archives, backups and generated release bundles are ignored.
The check flags private artifacts and recognized credential formats in Git
candidates; it is not an exhaustive secret scanner. The existing `.openai`
metadata supports the optional Sites target and contains no login/API credentials.

When you choose to deploy, follow [the VPS guide](deploy/VPS.md). It supports a
GitHub checkout built directly on the VPS, or prebuilt images transferred later.
Both use the existing Docker HTTPS proxy and keep app/engine ports unpublished.

## Play and practice

- Choose Pip, Clover, Scout, or Atlas, playing White or Black. Hints, legal-move highlights, takebacks, promotions, resignation, and board rotation are available. Bot levels are approximate practice difficulty, not calibrated Elo ratings. Games are untimed.
- Choose browser Stockfish, the lightweight practice engine, Maia, Leela Chess Zero, Arasan, or Fairy-Stockfish. Native engines require the Docker engine service. Every bot reply has a one-second pause after calculation.
- Get move feedback, recommended alternatives, replay, an evaluation chart, and a post-game review. Games and unfinished positions are saved to your private account.
- Practice **88 original teaching drills, eight per subject**: pawn storms, king-and-pawn endgames, queenless endgames, attack, defense, traps, forks, skewers, discovered attacks, mate in one, and mate in two. Hints and explanations are included; clean completions and assisted completions are tracked separately. Mate-in-two positions are verified against every legal defense and accept alternative forced mates. Other drills demonstrate a selected teaching line rather than every possible defense.
- On phones, the latest moves, move feedback, hints and suggested alternative appear in a banner above the board. The desktop coach and move-history layout remains available. Games and drills use a sage-and-ivory board and flat, outlined original Staunton pieces.
- Play 19 longer positions against a chosen bot and engine: three pawn storms, two king-and-pawn endings, eight queenless endgames, three attacks and three defenses. **Practice → Queenless endgames** includes the scattered position with a king, one bishop, one rook, one knight and six pawns on each side, plus rook/pawn, bishop/pawn, knight/pawn, bishop-versus-knight, opposite-color bishop, rook-and-knight, and rook-and-bishop combinations. Attack and defense practice includes king safety, active rooks, coordinated minor pieces and stopping an advanced passed pawn. These games get coaching and enter your saved library. Choose White or Black in the opponent dialog’s playing-color options.

## Import and study your games

Under **Import**:

1. Save your usernames, separated by commas. `1000waystoblunder` is the initial personal default; add aliases from other platforms in Import or Settings. Matching against the PGN White/Black headers ignores capitalization and surrounding whitespace.
2. Choose one or many PGN files, or paste PGN text. Files are read as streams: up to **100 MB / 25,000 games per file**, with **500 KB / 2,000 plies per individual game**. Games are validated and saved in atomic batches of up to 25. Invalid games stop the current file with a useful location; earlier saved batches are kept.
3. Alternatively, use **Import from Chess.com → Find my games**, select months, and import them. This uses Chess.com’s published read-only API and never asks for your Chess.com password. Requests run sequentially. Only completed public standard-chess games with moves are imported; variants and empty games are skipped. Archives may lag recent games. [Chess.com API documentation](https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it).
4. Open **My games → Analyze / resume my games**. Stockfish reviews your matching player’s moves and recommends alternatives. Checkpoints save every 10 reviewed moves and at game end. You can pause and resume; reviewed moves are skipped. Keep the tab open and your device awake. Switching away pauses after the current position. Large archives can take hours. Bulk analysis makes no paid LLM calls.

The bulk importer assigns a stable ID to each normalized PGN. Re-importing the same game preserves its existing analysis; a PGN with changed headers/comments may have a different ID. If import is interrupted, select the same files or months again to resume by skipping duplicates. Unmatched games stay in your library and can be reviewed individually. Single-game imported analysis focuses on your matched color; if neither name matches, it analyzes both sides.

The library loads 50 lightweight records at a time and fetches full PGNs/reviews when opened. Search runs on the server. **Export all PGNs** streams the entire library, including unloaded pages. Main lines are analyzed; chess.js does not preserve PGN variations in exports. Practice drills and bot statistics are not an official rating.

## Ordinary Docker Engine

Requires Docker Engine and Compose on a **Linux x86-64 host**. Native engine compilation/model download makes the first build slower; later builds use cache. Budget about 3 GB RAM for the app and native engines together.

```sh
node docker/setup.mjs
docker compose up -d --build
```

Open `http://localhost:3000`. Use `CHESSITO_USERNAME` and `CHESSITO_PASSWORD` from the private `.env`. The setup script preserves an existing `.env` and never prints the password. Passwords must have at least 16 characters. A ChatGPT/Cloudflare account is not needed for Docker.

On this Windows workstation, ordinary Docker Engine is installed in the separate **ChessitoEngine** Ubuntu WSL distribution. Docker Desktop is not needed. From PowerShell in this repository:

```powershell
.\docker\engine.ps1 compose up -d --build
.\docker\engine.ps1 compose ps
.\docker\engine.ps1 compose logs --tail 50
.\docker\engine.ps1 compose restart
.\docker\engine.ps1 compose down
```

The wrapper runs Linux Docker through WSL; the Windows Docker CLI’s Desktop context is separate. Docker Engine starts with the WSL distribution via systemd. After Windows restarts, run the first command to start WSL and the app. The prior Desktop Chessito volume was copied into the Engine volume while the original disk was mounted read-only. A separate pre-migration copy is at `/root/chessito-desktop-volume-backup` inside ChessitoEngine. Original Desktop data was left intact.

## Private HTTPS hosting and phone installation

The default published port is loopback-only. For a trusted LAN, set `CHESSITO_BIND_ADDRESS=0.0.0.0` in `.env` and recreate the app. On Windows/WSL, LAN access also depends on Windows firewall and WSL networking. Localhost on your phone points to the phone, not this computer.

For a private website accessible from other devices, deploy this checkout on a Linux Docker host. Point your DNS name to that host, permit ports 80/443, and set `CHESSITO_DOMAIN=chess.example.com` in the private `.env`:

```sh
docker compose -f compose.yaml -f compose.production.yaml up -d --build
```

Caddy supplies automatic HTTPS. The override removes the direct app port; native engines have no public port. If the VPS already has a Docker HTTPS proxy, use the image-based **`compose.vps.yaml`** deployment instead. It attaches only the app to the existing proxy network and publishes no host ports. See [VPS deployment instructions](deploy/VPS.md) for the release bundle, Cloudflare DNS, origin certificates, updates and backups. The gateway rejects a different host/origin.

On this Windows workstation, `scripts/package-vps.ps1` builds and exports a versioned Linux x86-64 release archive under `outputs/vps`, with SHA-256 checksums. It contains prebuilt app/engine images and deployment instructions, excluding user data and secrets. Use `-SkipBuild` only after building current images successfully. The VPS can load these images without compiling the engines or installing Node.js.

On a phone, open your HTTPS address. **iPhone:** Safari → Share → Add to Home Screen. **Android:** browser menu → Install app / Add to Home screen. The in-app Install button provides guidance. Installation requires HTTPS (desktop localhost is a special secure-context exception). The manifest requests standalone display, has phone icons, and uses safe-area layout. The service worker caches only public offline guidance/icons; it does not cache private pages or API responses. The app needs a connection to load private data and sync; pending game drafts/results are retained locally where browser storage is available.

No public domain or remote host is configured automatically. Mobile viewport checks do not replace testing on your actual Safari/Android device.

## Persistence, privacy, and operations

The `chessito_data` volume stores `chessito.sqlite`, its WAL files, and `encryption-key`. Migrations run on startup. Existing self-hosted Wrangler/Miniflare records are imported into production SQLite once, leaving legacy files intact. Rebuilds/restarts and `docker compose down` preserve the volume; **`down -v` deletes it**.

Provider keys are AES-256-GCM encrypted, with random IVs and user/provider-bound authenticated data. The persistent encryption key must be backed up with the database. Keys are never returned to the browser, included in PGNs, or stored in localStorage. Switching providers removes the previous key on settings save. Usernames can be changed without replacing provider settings or keys.

Docker uses signed HttpOnly SameSite session cookies, origin checks, password-login rate limits, CSP nonces, request size/time limits, and bounded coaching/engine requests. The gateway strips spoofed identity/forwarding headers and binds the internal Next server to loopback. Containers run with dropped capabilities, no-new-privileges, read-only roots, bounded temporary storage, memory/CPU limits, health checks, and rotated logs. Logs omit request bodies, passwords, keys, and provider response details.

Played-game saves use revision checks to reject conflicting device updates. Unsynced drafts are kept locally and recovered on reconnect/reload. If another device changed the same game, recovery creates a separate draft. This depends on permitted browser storage; it is not a full offline chess app.

Create a consistent database/key backup:

```sh
docker compose exec -T chessito node docker/backup.mjs
```

The command prints the backup directory under `/data/backups`. Copy that directory to secure storage outside the Docker host with `docker compose cp chessito:/data/backups/<printed-directory-name> ./backup`. On this Windows machine, use `docker/engine.ps1` in place of `docker`. Protect backups as secrets. To restore, stop the app, preserve the current volume as a rollback copy, restore the matching database and encryption-key together, remove stale WAL/SHM files, ensure UID/GID 1000 ownership, and restart. Do not rotate the encryption key without migrating encrypted credentials.

Gemini, Claude, and OpenAI explanations are optional. Enter an exact model ID supported by your API account and use **Test saved connection**. Automatic explanations are off by default. Requested/enabled explanations send game context to that provider and may incur its API charges. Paid provider responses have not been verified with a real account. Browser searches use up to depth 12 / 1.2 seconds per position; they are estimates, not exhaustive analysis. Centipawn-loss statistics cap each move at 1,000 centipawns to avoid mate sentinel scores dominating averages.

## Development and checks

Use Node 24 (minimum 22.13). `npm install`, then `npm run dev` starts the Sites/Vinext preview, usually at `http://127.0.0.1:5173`. It simulates sign-in locally; do not expose that development server publicly. Production builds have a separate `.next-production` directory, avoiding development type/artifact conflicts.

```sh
npm run typecheck
npm test
npm run build:production
npm audit --omit=dev
```

For a fresh local D1 preview database, build with `npm run build`, then execute each SQL file in `drizzle/` once using the local Wrangler DB binding. Generate a separate ignored `.env.local` encryption secret for local key storage. Local, hosted Sites, and Docker databases are separate; transfer hosted games with PGN export/import. Hosted provider settings must be configured again when moving to Docker.

HTTP integration checks use an isolated test account by default at port 3100: `node tests/production-http.mjs` and `node tests/bulk-http.mjs`. Configure `TEST_ORIGIN`, `TEST_USERNAME`, and `TEST_PASSWORD` for another test deployment. They create/remove only unique test games. Bulk checks temporarily change then restore usernames. `node tests/engines-smoke.mjs` verifies all native engines return legal moves. `node tests/docker-smoke.mjs` checks persistence across restart using a fake provider key; it refuses an account that already has a real saved key. Set `CHESSITO_WSL_DISTRO=ChessitoEngine` when running the latter on Windows with the Engine wrapper.

## Engine source and licenses

- Stockfish.js 18.0.8 Lite, GPLv3. Unchanged single-thread loader/wasm in `public/engine`; license at `/engine/COPYING.txt`. [Corresponding source and build scripts](https://github.com/nmrugg/stockfish.js/tree/93c994592dcf3b4b21052ab925e9b534df9c0918), [source archive](https://github.com/nmrugg/stockfish.js/archive/93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz).
- Lc0 0.31.2, GPLv3: [pinned source](https://github.com/LeelaChessZero/lc0/tree/8ba8aa426460bbeda452754ff7d6a9bb60bb0e54), license in `/opt/lc0/COPYING` in the engine image.
- [Original Maia weights](https://github.com/CSSLab/maia-chess/tree/749204cf5979ce7f8b0412e804a4ee7c83c49ff8): 1100/1500/1900 human-trained models, Lc0 `go nodes 1`. The two easiest levels share 1100; training-data ratings are not measured bot Elo.
- Leela uses T1-256x10-distilled-swa-2432500 with 8–128 CPU search nodes. [Network reference](https://lczero.org/play/networks/bestnets/).
- Arasan 25.2: [pinned source](https://github.com/jdart1/arasan-chess/tree/729acdded807dc46b769110138a81edb1fbca30d), license in `/opt/arasan/LICENSE`, its own NNUE network, bounded strength/thinking time.
- Fairy-Stockfish 11.1 is Debian bookworm’s package. Notices are in `/usr/share/doc/fairy-stockfish/`. Only standard chess is supported in this app.
- chess.js: BSD-2-Clause. Chessito pieces and drills are original code assets. Chessito is independent of Chess.com.

Native searches validate FEN/full move history, allow only fixed catalog executables/options, cap concurrency at two, and have a timeout. To add another UCI engine, install its binary/model in `engines/Dockerfile`, add a fixed catalog entry/options to `engines/uci.mjs`, and rebuild. The app discovers the catalog. Browser uploads cannot install binaries or execute arbitrary paths.
