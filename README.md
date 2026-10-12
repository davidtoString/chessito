# Chessito

A private, responsive chess practice web app for a beginner. Built with React, Vinext, chess.js, Stockfish 18 Lite in a browser worker, and Cloudflare D1 through Sites.

## Features

- Play White or Black against Pip, Clover, Scout, or Atlas. Choose Stockfish or a small material-search practice engine. Difficulty combines engine strength and occasional random legal moves; these levels are not measured Elo ratings.
- Legal moves, check/checkmate, automatic draws, castling, en passant, all four promotions, click or drag moves, hints, takebacks, resignation, and board rotation.
- Engine feedback after each move, evaluation bar, post-game move replay, evaluation chart, mistakes to revisit, and a suggested alternative.
- Server-saved games and preferences scoped to the authenticated user, including unfinished games that can be resumed on another device.
- PGN file upload or pasted PGN, collections up to 50 games / 500 KB, validation before saving, and individual or full-library PGN export. Main lines are analyzed; variations/comments are not preserved in chess.js exports.
- Optional Gemini, Claude, and OpenAI explanations. Enter an exact model ID supported by your account. Save settings, then use Test saved connection. Automatic AI commentary is off by default. Providers may charge for API usage.
- Practice statistics and a beginner routine. Imported games are excluded from practice statistics.

## Privacy and access

The hosted Site is owner-private. Sites provides authentication; both API routes additionally require a user identity and scope stored data to that user. Mutation requests reject a mismatched Origin header. Provider keys use AES-256-GCM with per-key random IVs and user/provider-bound additional authenticated data. `COACH_ENCRYPTION_KEY` is a 32-byte hexadecimal runtime secret, configured through Sites. Keys never enter Git, PGN exports, localStorage, or API read responses. The UI can replace or remove the saved key. One provider configuration is saved at a time; switching providers removes the previous provider's key on save.

All engine calculations happen on the device. AI explanation requests send game context to the selected provider through an authenticated server endpoint. No AI calls occur without a configured key and a requested explanation or enabled automatic coaching. Automatic coaching is a preference, not a guarantee of a provider response.

## Local development

Requires Node 22.13+ (Node 24 recommended for the TypeScript test runner). Run `npm install`, then `npm run dev`. Local preview is at the printed loopback URL, normally `http://127.0.0.1:5173`. The starter simulates sign-in locally only. Local and hosted databases are separate.

For a fresh local database, run `npm run build`, then:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_tricky_lady_bullseye.sql
```

Run that initial migration once per fresh local database. For local key storage, generate a separate 32-byte hexadecimal value and place it in the ignored `.env.local` as `COACH_ENCRYPTION_KEY`. Never commit that file or rotate the hosted secret without migrating encrypted keys.

## Validation

- `npm run typecheck`
- `npm test`: checkmate/draw scoring, per-side evaluation loss, PGN collections and promotion from a custom FEN, illegal PGN rejection, legal practice-engine moves, castling, and en passant.
- `node tests/api-smoke.mjs`: requires local preview and a local test identity with no real saved key. Exercises anonymous denial, key save/read/preserve/remove, cross-origin denial, and missing-key errors. Restores original preferences and makes no external provider calls.
- Browser checks: Stockfish loading, move plus reply, feedback retention, saving/resuming, takeback, practice engine as Black, imported checkmate review, and mobile/desktop layouts.

Live provider responses require your own API credentials and have not been verified with a paid account. Short browser engine searches (depth 12 or 1.2 seconds per position) are learning aids, not exhaustive analysis. Average centipawn loss is capped at 1,000 centipawns per move so forced-mate sentinel scores do not dominate the statistic. Games are untimed; there is no competitive rating estimate or online multiplayer.

## Engine attribution

Stockfish.js 18.0.8 by Nathan Rugg / Chess.com and Stockfish contributors, GPL-3.0. The unchanged single-thread Lite engine is served in `public/engine` (loader renamed to `stockfish.js` with matching `stockfish.wasm`). Its license is served at `/engine/COPYING.txt`.

Corresponding upstream source and build scripts: https://github.com/nmrugg/stockfish.js/tree/93c994592dcf3b4b21052ab925e9b534df9c0918

Source archive: https://github.com/nmrugg/stockfish.js/archive/93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz

Rules and PGN parsing: chess.js (BSD-2-Clause). The app's custom SVG pieces require no external image service.
