CREATE UNIQUE INDEX IF NOT EXISTS publications_one_active_per_draft
  ON publications(draft_id)
  WHERE revoked_at IS NULL;
