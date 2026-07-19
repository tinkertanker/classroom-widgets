ALTER TABLE content_reports ADD COLUMN reviewed_at TEXT;
ALTER TABLE content_reports ADD COLUMN resolution TEXT CHECK (
  (reviewed_at IS NULL AND resolution IS NULL) OR
  (reviewed_at IS NOT NULL AND resolution IS NOT NULL AND
    resolution IN ('no-action', 'widget-revoked', 'teacher-contacted'))
);

CREATE INDEX IF NOT EXISTS content_reports_unreviewed
  ON content_reports(reviewed_at, created_at ASC);
