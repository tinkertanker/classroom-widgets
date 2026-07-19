PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS drafts_owner_updated
  ON drafts(owner_hash, updated_at DESC);

CREATE TABLE IF NOT EXISTS draft_versions (
  draft_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  spec_json TEXT NOT NULL,
  instruction TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (draft_id, version),
  FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS publications (
  slug TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  owner_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS publications_owner_created
  ON publications(owner_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS publications_expiry
  ON publications(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  alternative_text TEXT,
  decorative INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS assets_owner_created
  ON assets(owner_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS generation_usage (
  owner_hash TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_hash, usage_date)
);
