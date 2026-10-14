import { spawnSync } from 'node:child_process';
import { readFileSync, statSync, existsSync } from 'node:fs';

const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
if (result.status !== 0) throw new Error('Cannot inspect the Git file list.');
const files = [...new Set(result.stdout.split('\0').filter(Boolean))];
const failures = [];
const privateFile = /(^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519)$|\.(?:sqlite(?:-[\w]+)?|db|pgn|pem|key|p12|pfx|tsbuildinfo)$/i;
const privateFolder = /^(?:outputs|work|data|backups|node_modules|\.next(?:-production)?|\.wrangler|\.sites-runtime|\.agents|\.codex)\//;
const credentialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AIza[\w-]{35}/,
  /sk-ant-[\w-]{20,}/,
  /(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{40,}/,
];
// Also detect a locally generated login password accidentally copied into source.
let localPassword;
if (existsSync('.env')) localPassword = readFileSync('.env', 'utf8').match(/^CHESSITO_PASSWORD=(.+)$/m)?.[1]?.trim();
for (const file of files) {
  if (!existsSync(file)) continue; // Deleted files awaiting the user's commit.
  if ((privateFolder.test(file) || privateFile.test(file)) && !file.endsWith('.env.example')) {
    failures.push(file + ': private data or generated artifact'); continue;
  }
  if (statSync(file).size > 5_000_000) continue;
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  const content = bytes.toString('utf8');
  if (credentialPatterns.some(pattern => pattern.test(content)) || (localPassword?.length >= 16 && content.includes(localPassword))) {
    failures.push(file + ': possible credential');
  }
}
if (failures.length) {
  console.error('Repository check failed:\n' + failures.map(item => '- ' + item).join('\n'));
  process.exitCode = 1;
} else console.log(`PASS repository check: ${files.length} Git candidates checked; no private data, generated artifacts or recognized credentials found.`);
