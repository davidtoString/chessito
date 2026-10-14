import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
if (existsSync('.env')) {
  console.log('Existing .env kept. Start with: docker compose up -d --build');
} else {
  writeFileSync('.env', `CHESSITO_USERNAME=david\nCHESSITO_PASSWORD=${randomBytes(24).toString('hex')}\nCHESSITO_PORT=3000\nCHESSITO_BIND_ADDRESS=127.0.0.1\n`, {mode:0o600});
  console.log('Created private .env with a generated login password. Read it locally when signing in.\nStart with: docker compose up -d --build');
}
