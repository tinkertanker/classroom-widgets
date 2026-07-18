CREATE TABLE IF NOT EXISTS content_reports (
  id TEXT PRIMARY KEY,
  publication_slug TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('inappropriate', 'personal-data', 'copyright', 'accessibility', 'other')
  ),
  created_at TEXT NOT NULL,
  FOREIGN KEY (publication_slug) REFERENCES publications(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS content_reports_publication_created
  ON content_reports(publication_slug, created_at DESC);
