DROP TABLE IF EXISTS pilot_codes;

CREATE TABLE class_codes (
  code_hash TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  maximum_uses INTEGER NOT NULL CHECK (maximum_uses BETWEEN 1 AND 100),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE INDEX class_codes_expiry
  ON class_codes(expires_at);
