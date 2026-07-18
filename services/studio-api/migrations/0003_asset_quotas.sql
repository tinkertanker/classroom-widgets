CREATE TABLE IF NOT EXISTS asset_usage (
  owner_hash TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  upload_count INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_hash, usage_date)
);
