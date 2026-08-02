ALTER TABLE artifacts ADD COLUMN summary TEXT NOT NULL DEFAULT '';
ALTER TABLE artifacts ADD COLUMN subject TEXT;
ALTER TABLE artifacts ADD COLUMN level TEXT;
ALTER TABLE artifacts ADD COLUMN locale TEXT DEFAULT 'en-SG';
ALTER TABLE artifacts ADD COLUMN learning_objective TEXT;
ALTER TABLE artifacts ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE artifacts ADD COLUMN generation_brief_json TEXT NOT NULL DEFAULT '{}';
UPDATE artifacts SET
  summary = title,
  locale = coalesce(locale, 'en-SG'),
  generation_brief_json = CASE WHEN json_valid(creation_brief) THEN creation_brief ELSE '{}' END;
