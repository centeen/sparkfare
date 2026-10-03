-- ROADMAP step 35 (Pinterest OAuth + Pin creation, Standard-access demo).
-- Exactly one Pinterest account will ever connect (Sparkfare's own), so this is a single-row
-- table keyed by a fixed id ('default', PINTEREST_TOKEN_ROW_ID in src/pinterest.js) rather than
-- per-user rows. Token values are stored AES-GCM encrypted (see encryptToken/decryptToken in
-- src/pinterest.js), keyed by the PINTEREST_TOKEN_ENCRYPTION_KEY Worker secret -- never plaintext.
--
-- Rollback: DROP TABLE pinterest_tokens; -- purely additive, no other table/column touched.

CREATE TABLE IF NOT EXISTS pinterest_tokens (
  id TEXT PRIMARY KEY,
  access_token_ciphertext TEXT NOT NULL,
  access_token_iv TEXT NOT NULL,
  refresh_token_ciphertext TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  scopes TEXT NOT NULL,
  connected_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
