-- Publications are intentionally reset, but moderation history is not. The old
-- publication foreign key cannot target the new, empty publication table. Copy
-- reports into an FK-free table before dropping the old child and parent tables;
-- D1 migrations run in a transaction where foreign_keys cannot be disabled.
CREATE TABLE content_reports_preserved (
  id TEXT PRIMARY KEY,
  publication_slug TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('inappropriate', 'personal-data', 'copyright', 'accessibility', 'other')
  ),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  resolution TEXT CHECK (
    (reviewed_at IS NULL AND resolution IS NULL) OR
    (reviewed_at IS NOT NULL AND resolution IS NOT NULL AND
      resolution IN ('no-action', 'widget-revoked', 'teacher-contacted'))
  )
);
INSERT INTO content_reports_preserved
  (id, publication_slug, reason, created_at, reviewed_at, resolution)
SELECT id, publication_slug, reason, created_at, reviewed_at, resolution
FROM content_reports;
DROP TABLE content_reports;
DROP TABLE IF EXISTS retrieval_fts;
DROP TABLE IF EXISTS retrieval_entries;
DROP TABLE IF EXISTS revision_assets;
DROP TABLE IF EXISTS publications;
DROP TABLE IF EXISTS draft_versions;
DROP TABLE IF EXISTS drafts;
CREATE TABLE artifacts(id TEXT PRIMARY KEY,owner_hash TEXT NOT NULL,title TEXT NOT NULL,creation_brief TEXT NOT NULL,head_revision_id TEXT NOT NULL,remixed_from_revision_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX artifacts_owner_updated ON artifacts(owner_hash,updated_at DESC);
CREATE TABLE revisions(id TEXT PRIMARY KEY,artifact_id TEXT NOT NULL,parent_revision_id TEXT,source_hash TEXT NOT NULL,source_bytes INTEGER NOT NULL CHECK(source_bytes BETWEEN 1 AND 200000),kind TEXT NOT NULL CHECK(kind IN('generation','revision','remix','import')),instruction TEXT,design_card_json TEXT,exemplars_json TEXT NOT NULL DEFAULT '[]',model_version TEXT NOT NULL,prompt_version TEXT NOT NULL,screenshot_key TEXT,created_at TEXT NOT NULL,FOREIGN KEY(artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,FOREIGN KEY(parent_revision_id) REFERENCES revisions(id));
CREATE TABLE revision_assets(revision_id TEXT NOT NULL,asset_id TEXT NOT NULL,PRIMARY KEY(revision_id,asset_id),FOREIGN KEY(revision_id) REFERENCES revisions(id) ON DELETE CASCADE,FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE RESTRICT);
CREATE TABLE publications(slug TEXT PRIMARY KEY,artifact_id TEXT NOT NULL,revision_id TEXT NOT NULL,owner_hash TEXT NOT NULL,title TEXT NOT NULL,source_hash TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,revoked_at TEXT,FOREIGN KEY(artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,FOREIGN KEY(revision_id) REFERENCES revisions(id));
CREATE UNIQUE INDEX publications_one_active ON publications(artifact_id) WHERE revoked_at IS NULL;
ALTER TABLE content_reports_preserved RENAME TO content_reports;
CREATE INDEX content_reports_publication_created ON content_reports(publication_slug,created_at DESC);
CREATE INDEX content_reports_unreviewed ON content_reports(reviewed_at,created_at ASC);
CREATE TABLE retrieval_entries(artifact_id TEXT PRIMARY KEY,revision_id TEXT NOT NULL,descriptor TEXT NOT NULL,curated INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,FOREIGN KEY(artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,FOREIGN KEY(revision_id) REFERENCES revisions(id));
CREATE VIRTUAL TABLE retrieval_fts USING fts5(artifact_id UNINDEXED,title,descriptor);
CREATE TRIGGER retrieval_ai AFTER INSERT ON retrieval_entries BEGIN INSERT INTO retrieval_fts(artifact_id,title,descriptor) SELECT new.artifact_id,title,new.descriptor FROM artifacts WHERE id=new.artifact_id; END;
CREATE TRIGGER retrieval_au AFTER UPDATE ON retrieval_entries BEGIN DELETE FROM retrieval_fts WHERE artifact_id=old.artifact_id; INSERT INTO retrieval_fts(artifact_id,title,descriptor) SELECT new.artifact_id,title,new.descriptor FROM artifacts WHERE id=new.artifact_id; END;
CREATE TRIGGER retrieval_ad AFTER DELETE ON retrieval_entries BEGIN DELETE FROM retrieval_fts WHERE artifact_id=old.artifact_id; END;
