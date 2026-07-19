CREATE TABLE IF NOT EXISTS pilot_codes (
  code_hash TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  maximum_uses INTEGER NOT NULL DEFAULT 1 CHECK (maximum_uses BETWEEN 1 AND 100),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS pilot_codes_expiry
  ON pilot_codes(expires_at);
