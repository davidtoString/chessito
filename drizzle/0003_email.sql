-- Email addresses (verified before they can receive a password reset), one-time email tokens, and email-bound invites.
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email) WHERE email IS NOT NULL;
ALTER TABLE invites ADD COLUMN email TEXT;
CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS email_tokens_user ON email_tokens (user_id, purpose);
