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

- Choose from 22 bots (see [Bots](#bots)), playing White or Black. Hints, legal-move highlights, takebacks, promotions, resignation, and board rotation are available. Bot strengths are approximate targets, not measured Elo ratings.
- Choose browser Stockfish, the lightweight practice engine, Maia, Leela Chess Zero, Arasan, or Fairy-Stockfish. Native engines require the Docker engine service. Untimed games add a one-second pause to every bot reply; timed games use 0.25 seconds.
- Get move feedback, recommended alternatives, replay, an evaluation chart, and a post-game review. Games and unfinished positions are saved to your private account.
- Practice **88 original teaching drills, eight per subject**: pawn storms, king-and-pawn endgames, queenless endgames, attack, defense, traps, forks, skewers, discovered attacks, mate in one, and mate in two. Hints and explanations are included; clean completions and assisted completions are tracked separately. Mate-in-two positions are verified against every legal defense and accept alternative forced mates. Other drills demonstrate a selected teaching line rather than every possible defense.
- On phones, the latest moves, move feedback, hints and suggested alternative appear in a banner above the board. The desktop coach and move-history layout remains available. Games and drills use a sage-and-ivory board and flat, outlined original Staunton pieces.
- Play 19 longer positions against a chosen bot and engine: three pawn storms, two king-and-pawn endings, eight queenless endgames, three attacks and three defenses. **Practice → Queenless endgames** includes the scattered position with a king, one bishop, one rook, one knight and six pawns on each side, plus rook/pawn, bishop/pawn, knight/pawn, bishop-versus-knight, opposite-color bishop, rook-and-knight, and rook-and-bishop combinations. Attack and defense practice includes king safety, active rooks, coordinated minor pieces and stopping an advanced passed pawn. These games get coaching and enter your saved library. Choose White or Black in the opponent dialog’s playing-color options.

## Bots

The New game window groups the bots into four tabs; the list is in `lib/bots.ts`, the move logic in `lib/bot-move.ts` and `lib/bot-books.ts`.

- **Ladder (12 bots, about 400 to 3000):** Pip, Clover, Maple, Scout, Juniper, Ember, Harbor, Quill, Atlas, Nova, Titan and Maximus. Up to about 1300 a weaker Stockfish search is mixed with random moves; from Ember (1400) the engine's own `UCI_Elo` limiter sets the strength; Maximus is full strength.
- **With a style:** Gambit Gwen (prefers checks, captures and sacrifices), Walter the Wall (develops, castles, trades when ahead), Sicilian Sam and London Lou (play an opening repertoire from `lib/bot-books.ts`, then hand over to the engine), Oops Ollie (plays well but slips about 14% of the time) and Tick (moves almost instantly and plays worse as its own clock runs down; timed games only). Style bots choose among the engine's top four lines, so they stay near their rating while playing differently.
- **Handicap:** Pawnless Pete (no f-pawn), Knightless Kai (no queenside knight), Rookless Rae (no queenside rook) and Queenless Quinn (no queen). The bot starts a piece down and plays at 2000 to 3000.
- **Custom:** a slider from 400 to 3000.

Strengths are approximate: the engine runs in the player's browser with a short thinking time, so real strength varies. Stored games keep only the bot's index, so **never reorder or remove entries in `bots`**; append new bots at the end. Custom bots are stored as 1000 plus their Elo. Native engines (Maia and so on) only know four levels, so every bot maps to the nearest one, and they are available to the owner only.

## Play, learn and analyze (chess.com-style)

- **Play:** clocks (1–30 min, increments), premoves, move sounds (synthesized, no audio files), right-click arrows and highlights, draw offers, rematch and a game-over summary. Captured pieces and material lead show in the player bars.
- **Game review:** accuracy for both sides (Lichess's open win-probability curve; an estimate, not chess.com's figure), move ratings (Book, Brilliant, Great, Best, Excellent, Good, Inaccuracy, Mistake, Blunder) with on-board badges, a clickable evaluation graph and a deeper re-check of the worst moves.
- **Analysis:** a free board with live top-3 Stockfish lines, opening names, FEN/PGN loading and arrow-key navigation.
- **Puzzles:** about 3,800 rated puzzles plus about 2,100 themed puzzles (38 themes), a daily puzzle with a streak, and an Elo-style puzzle rating.
- **Learn:** 53 original lessons in five groups (Basics, Tactics, Strategy, Endgames, Openings) with interactive boards, a short quiz after each lesson, and a Quick review that replays tasks from lessons you have finished. A **Classic games** library has 38 games, from the Immortal Game to Gukesh's 2024 title win, including ten Carlsen and Nakamura games and six online games from GothamChess and Alexandra Botez (filter by player; the Chess.com games link back to the original), to replay move by move with an evaluation graph, move ratings, the key moments explained, and an "Open in analysis board" button. An opening trainer covers 154 lines in 27 openings, and the 88 original drills are in the Drills tab.
- **Explanations:** **Why?** under a reviewed move compares it with the engine's best move in plain language (material won or lost, forks, pins, loose pieces, missed mates) and **Scan** lists checks, captures and threats. The Analysis board has the same **Why?** on each engine line. These work with no API key; with a provider key an **Explain with AI** button turns the same engine facts into a step-by-step explanation. Only supplied facts and engine lines are sent.
- **Puzzle training:** retry any puzzle without a rating change, a **Retry missed** set, a **Think first** mode (name up to three candidate moves before playing; afterwards they are checked against the solution), and a "Why it works" panel after each puzzle: checks/captures/threats, the pattern, the solution move by move and why the alternatives fail.
- **My games:** filter by result (Wins, Losses, Draws, Unfinished), by opponent (all games, bots only, one specific bot, or imported games) and by month (from the game's own PGN date), and sort newest or oldest with month headings. The result counts and the month list follow the opponent filter.
- **Look:** eight colour palettes, seven board colours, two piece sets (modern RhosGFX, CC0, and the original Chessito set), three self-hosted fonts, and original bot avatars. Choices are per device (Settings → Appearance).
- **Lesson checks:** `tests/lessons.test.ts` validates every position, move and claimed mate. `scripts/verify-lessons.mjs` (needs a Stockfish binary: `STOCKFISH=/usr/games/stockfish node --experimental-strip-types scripts/verify-lessons.mjs`) checks that every accepted answer is engine-sound.

Data in `public/data` comes from Lichess (CC0): [chess-openings](https://github.com/lichess-org/chess-openings) and the [puzzle database](https://database.lichess.org/#puzzles), and the classic games from the free downloads at [PGN Mentor](https://www.pgnmentor.com) and, for the streamer games, [Chess.com's public API](https://www.chess.com/news/view/published-data-api) (only the moves and game facts are kept, opponents are shown by rating, and each game links to its original page; they were picked from the players' archives using engine-detected highlights, not as a list of famous games) (the moves are validated with chess.js and evaluated with Stockfish by `scripts/data/classics.mjs`; the commentary in `lib/classics.ts` is original and checked against the moves by `tests/classics.test.ts`). The files are static samples; regenerate them for a different mix.

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

On a phone, open your HTTPS address. **iPhone:** Safari → Share → Add to Home Screen. **Android:** browser menu → Install app / Add to Home screen. Settings → Install on your phone has the same steps. Installation requires HTTPS (desktop localhost is a special secure-context exception). The manifest requests standalone display, has phone icons, and uses safe-area layout. The service worker caches only public offline guidance/icons; it does not cache private pages or API responses. The app needs a connection to load private data and sync; pending game drafts/results are retained locally where browser storage is available.

No public domain or remote host is configured automatically. Mobile viewport checks do not replace testing on your actual Safari/Android device.

## Accounts and sharing with friends

Chessito has real accounts. The owner account is created on first start from `CHESSITO_USERNAME` and `CHESSITO_PASSWORD` in `.env` and keeps all existing games and settings. After that, sign in and **change the password in Settings → Account**; later changes to `CHESSITO_PASSWORD` are ignored.

- **Invite-only:** in Settings → Account the owner creates invite links (valid 1/7/30 days, for 1/5/20 people). A friend opens the link, picks a username (3–32 characters) and a password (at least 10), and is signed in. There is no open sign-up. Set `CHESSITO_SIGNUP=closed` to stop new accounts entirely.
- **Private by default:** every account has its own games, puzzle rating, lesson progress, settings and encrypted AI key. Friends never see each other's data. The owner can see who has joined, disable or remove a member (which deletes their data), and revoke invites. The owner can also read the database on the server, so only invite people you trust.
- **One administrator:** only the owner account (`docker-owner`, the user created from `CHESSITO_USERNAME`) can be an admin. A database rule (`drizzle/0004_single_admin.sql`) rejects any other account holding a non-member role and any change to the owner's role, and the gateway checks `auth.isOwner` for every admin action. Invites, the People list, disabling or deleting members are owner-only.
- **Members can** change their password, sign out other devices, delete their own account and data, and use everything for playing and learning (browser Stockfish, the built-in coach, lessons, puzzles, classic games, appearance and sound). **Members cannot** change settings (AI coach provider and API key), use the AI coach, or use the server engines; those requests return 403 and the Settings page explains that the owner manages them.
- **Security:** passwords are hashed with scrypt; sessions are random tokens stored server-side (so signing out, changing a password, disabling or deleting an account takes effect immediately); logins are rate-limited per username and per visitor address (the real address is read from Cloudflare's `CF-Connecting-IP` when the request comes through a private proxy); account changes require a matching `Origin`.
- **Remember me:** the sign-in page has a "Remember me on this device" checkbox (ticked by default). Ticked keeps you signed in for 30 days; unticked is a browser-session login that also expires on the server after 12 hours. Use it unticked on a shared computer.
- **Email through Resend (optional):** with email on, members can reset a forgotten password by email, the owner can email invites straight to a friend, and anyone can confirm an address in Settings → Account. To turn it on:
  1. Create an API key at [resend.com](https://resend.com) and verify a sending domain there (add the DNS records Resend shows; with Cloudflare, set them to DNS only). Until a domain is verified, Resend only delivers to your own account's address.
  2. Put `RESEND_API_KEY=...` and `CHESSITO_EMAIL_FROM="Chessito <chess@your-verified-domain>"` in `.env`, then recreate the container (`docker compose ... up -d`).
  3. Check it: `docker compose exec chessito node docker/users.mjs test-email you@example.com`.
  Reset links last 1 hour and work once; a typo in the new password does not use up the link; confirmation and reset emails only go to an address its owner confirmed (an invite emailed to an address confirms it for that friend). "Forgot password" gives the same answer whether or not an account exists, and sending is rate-limited. Without these settings none of this appears, and invite links are shared by hand.
- **Owner tools** (inside the container): `docker compose exec chessito node docker/users.mjs list`, `... reset-password <username>` (prints a new random password once) and `... invite [days] [uses]` and `... test-email <address>`. Use `reset-password` if the owner is locked out.
- `tests/auth.test.mjs` and `tests/mail.test.mjs` cover the account and email logic; `tests/accounts-http.mjs` runs the whole friend flow, and `tests/email-http.mjs` the email flows against a fake Resend server, each on a running container (see the file headers for the commands).

## Persistence, privacy, and operations

The `chessito_data` volume stores `chessito.sqlite`, its WAL files, and `encryption-key`. Migrations run on startup. Existing self-hosted Wrangler/Miniflare records are imported into production SQLite once, leaving legacy files intact. Rebuilds/restarts and `docker compose down` preserve the volume; **`down -v` deletes it**.

Provider keys are AES-256-GCM encrypted, with random IVs and user/provider-bound authenticated data. The persistent encryption key must be backed up with the database. Keys are never returned to the browser, included in PGNs, or stored in localStorage. Switching providers removes the previous key on settings save. Usernames can be changed without replacing provider settings or keys.

Docker uses server-side sessions in HttpOnly SameSite cookies, origin checks, per-account and per-address login rate limits, CSP nonces, request size/time limits, and bounded coaching/engine requests. The gateway strips spoofed identity/forwarding headers and binds the internal Next server to loopback. Containers run with dropped capabilities, no-new-privileges, read-only roots, bounded temporary storage, memory/CPU limits, health checks, and rotated logs. Logs omit request bodies, passwords, keys, and provider response details.

Played-game saves use revision checks to reject conflicting device updates. Unsynced drafts are kept locally and recovered on reconnect/reload. If another device changed the same game, recovery creates a separate draft. This depends on permitted browser storage; it is not a full offline chess app.

Create a consistent database/key backup:

```sh
docker compose exec -T chessito node docker/backup.mjs
```

The command prints the backup directory under `/data/backups`. Copy that directory to secure storage outside the Docker host with `docker compose cp chessito:/data/backups/<printed-directory-name> ./backup`. On this Windows machine, use `docker/engine.ps1` in place of `docker`. Protect backups as secrets. To restore, stop the app, preserve the current volume as a rollback copy, restore the matching database and encryption-key together, remove stale WAL/SHM files, ensure UID/GID 1000 ownership, and restart. Do not rotate the encryption key without migrating encrypted credentials.

Gemini, Claude, OpenAI and OpenRouter (any model, e.g. `google/gemini-2.5-flash`) explanations are optional. Enter an exact model ID supported by your API account and use **Test saved connection**. Automatic explanations are off by default. Requested/enabled explanations send game context to that provider and may incur its API charges. Paid provider responses have not been verified with a real account. Browser searches use up to depth 12 / 1.2 seconds per position; they are estimates, not exhaustive analysis. Centipawn-loss statistics cap each move at 1,000 centipawns to avoid mate sentinel scores dominating averages.

## Release and rollback routine

For each change: run `npm run typecheck`, `npm test` and `npm run build:production`, check the screens in a browser (a throwaway container works), then deploy:

```sh
C="docker compose -p chessito -f compose.vps.yaml -f compose.traefik.yaml"
$C exec -T chessito node docker/backup.mjs                      # data backup
docker tag chessito-app:local chessito-app:rollback-<name>      # keep the running image
$C build chessito && $C up -d --no-deps chessito                # then wait for "healthy"
```

To roll back, retag the saved image as `chessito-app:local` and run `$C up -d --no-deps chessito`; restore data from `/data/backups` if a migration must be undone. The container restarts for a few seconds during a deploy, so players see a short "server is restarting" message; avoid deploying mid-game.

## How many users, and scaling

The chess engine runs in each player's browser, so players cost the server very little: it handles sign-in, game storage and the optional AI coach calls. The container idles at around 100 MB of memory and almost no CPU. These are estimates, not load-test results:

- Up to a few hundred registered friends: fine as is.
- About 1,000 registered with a few dozen playing at once: probably fine on a small VPS; load test first.
- Beyond that, the limits are sign-in (scrypt costs about 50 to 100 ms of CPU per login), the single SQLite writer (every move saves the game), and one container (deploys cause a short outage).

Order of work to scale: raise container limits and add an uptime check, run a load test (k6), move to Postgres and run several app copies behind Traefik (sessions are already server-side), rate-limit the AI coach per user, and queue outgoing email. Native engines run on the server and are owner-only; keep them that way.

## Development and checks

Use Node 24 (minimum 22.13). `npm install`, then `npm run dev` starts the Sites/Vinext preview, usually at `http://127.0.0.1:5173`. It simulates sign-in locally; do not expose that development server publicly. Production builds have a separate `.next-production` directory, avoiding development type/artifact conflicts.

```sh
npm run typecheck
npm test
npm run build:production
npm audit --omit=dev
```

For a fresh local D1 preview database, build with `npm run build`, then execute each SQL file in `drizzle/` once using the local Wrangler DB binding. Generate a separate ignored `.env.local` encryption secret for local key storage. Local, hosted Sites, and Docker databases are separate; transfer hosted games with PGN export/import. Hosted provider settings must be configured again when moving to Docker.

`npm test` runs the unit tests (`tests/*.test.ts` and `tests/*.test.mjs`, including bots, classic games, lessons, puzzles, sounds, piece sets, auth, email and the single-admin database rules).

HTTP integration checks run against a container on port 3100 built from this repository (`docker build -t chessito-test .`, then `docker run -d -p 127.0.0.1:3100:3000 -e CHESSITO_USERNAME=test-owner -e CHESSITO_PASSWORD=<test password> -e CHESSITO_PUBLIC_ORIGIN=http://127.0.0.1:3100 chessito-test`). `node tests/accounts-http.mjs` covers invites, sessions, isolation and the owner-only rules; `node tests/library-http.mjs` needs a fresh container because it expects an empty library; `node tests/email-http.mjs` has its own instructions in its header. The older checks also use port 3100: `node tests/production-http.mjs` and `node tests/bulk-http.mjs`. Configure `TEST_ORIGIN`, `TEST_USERNAME`, and `TEST_PASSWORD` for another test deployment. They create/remove only unique test games. Bulk checks temporarily change then restore usernames. `node tests/engines-smoke.mjs` verifies all native engines return legal moves. `node tests/docker-smoke.mjs` checks persistence across restart using a fake provider key; it refuses an account that already has a real saved key. Set `CHESSITO_WSL_DISTRO=ChessitoEngine` when running the latter on Windows with the Engine wrapper.

## Engine source and licenses

- Stockfish.js 18.0.8 Lite, GPLv3. Unchanged single-thread loader/wasm in `public/engine`; license at `/engine/COPYING.txt`. [Corresponding source and build scripts](https://github.com/nmrugg/stockfish.js/tree/93c994592dcf3b4b21052ab925e9b534df9c0918), [source archive](https://github.com/nmrugg/stockfish.js/archive/93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz).
- Lc0 0.31.2, GPLv3: [pinned source](https://github.com/LeelaChessZero/lc0/tree/8ba8aa426460bbeda452754ff7d6a9bb60bb0e54), license in `/opt/lc0/COPYING` in the engine image.
- [Original Maia weights](https://github.com/CSSLab/maia-chess/tree/749204cf5979ce7f8b0412e804a4ee7c83c49ff8): 1100/1500/1900 human-trained models, Lc0 `go nodes 1`. The two easiest levels share 1100; training-data ratings are not measured bot Elo.
- Leela uses T1-256x10-distilled-swa-2432500 with 8–128 CPU search nodes. [Network reference](https://lczero.org/play/networks/bestnets/).
- Arasan 25.2: [pinned source](https://github.com/jdart1/arasan-chess/tree/729acdded807dc46b769110138a81edb1fbca30d), license in `/opt/arasan/LICENSE`, its own NNUE network, bounded strength/thinking time.
- Fairy-Stockfish 11.1 is Debian bookworm’s package. Notices are in `/usr/share/doc/fairy-stockfish/`. Only standard chess is supported in this app.
- chess.js: BSD-2-Clause. Chessito pieces and drills are original code assets. Chessito is independent of Chess.com.

Native searches validate FEN/full move history, allow only fixed catalog executables/options, cap concurrency at two, and have a timeout. To add another UCI engine, install its binary/model in `engines/Dockerfile`, add a fixed catalog entry/options to `engines/uci.mjs`, and rebuild. The app discovers the catalog. Browser uploads cannot install binaries or execute arbitrary paths.
