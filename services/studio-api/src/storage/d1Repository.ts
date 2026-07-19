import type { WidgetSpec } from '@classroom-widgets/widget-spec';
import type {
  DraftRecord,
  ContentReportInput,
  ExtendPublicationResult,
  PublicationRecord,
  PublishInput,
  PublishResult,
  SaveDraftInput,
  StudioRepository,
  UpdateDraftInput,
} from './repository';

interface DraftRow {
  id: string;
  owner_hash: string;
  title: string;
  schema_version: string;
  spec_json: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface PublicationRow {
  slug: string;
  draft_id: string;
  owner_hash: string;
  title: string;
  schema_version: string;
  spec_json: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

function draftFrom(row: DraftRow): DraftRecord {
  return {
    id: row.id,
    ownerHash: row.owner_hash,
    title: row.title,
    schemaVersion: row.schema_version,
    spec: JSON.parse(row.spec_json) as WidgetSpec,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicationFrom(row: PublicationRow): PublicationRecord {
  return {
    slug: row.slug,
    draftId: row.draft_id,
    ownerHash: row.owner_hash,
    title: row.title,
    schemaVersion: row.schema_version,
    spec: JSON.parse(row.spec_json) as WidgetSpec,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export class D1StudioRepository implements StudioRepository {
  constructor(private readonly database: D1Database) {}

  async consumeGeneration(ownerHash: string, usageDate: string, limit: number): Promise<boolean> {
    const result = await this.database
      .prepare(
        `INSERT INTO generation_usage (owner_hash, usage_date, request_count)
         VALUES (?1, ?2, 1)
         ON CONFLICT(owner_hash, usage_date)
         DO UPDATE SET request_count = request_count + 1
         WHERE request_count < ?3`,
      )
      .bind(ownerHash, usageDate, limit)
      .run();
    return (result.meta.changes ?? 0) === 1;
  }

  async countDrafts(ownerHash: string): Promise<number> {
    const result = await this.database
      .prepare('SELECT COUNT(*) AS draft_count FROM drafts WHERE owner_hash = ?1')
      .bind(ownerHash)
      .first<{ draft_count: number }>();
    return result?.draft_count ?? 0;
  }

  async purgeUsage(beforeDate: string): Promise<void> {
    await this.database
      .prepare('DELETE FROM generation_usage WHERE usage_date < ?1')
      .bind(beforeDate)
      .run();
  }

  async consumePilotCode(codeHash: string, now: string): Promise<boolean> {
    const result = await this.database
      .prepare(
        `UPDATE pilot_codes
            SET use_count = use_count + 1, last_used_at = ?1
          WHERE code_hash = ?2
            AND use_count < maximum_uses
            AND expires_at > ?1`,
      )
      .bind(now, codeHash)
      .run();
    return (result.meta.changes ?? 0) === 1;
  }

  async createDraft(input: SaveDraftInput): Promise<DraftRecord> {
    const specJson = JSON.stringify(input.spec);
    await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO drafts
             (id, owner_hash, title, schema_version, spec_json, version, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)`,
        )
        .bind(
          input.id,
          input.ownerHash,
          input.title,
          input.schemaVersion,
          specJson,
          input.now,
        ),
      this.database
        .prepare(
          `INSERT INTO draft_versions (draft_id, version, spec_json, instruction, created_at)
           VALUES (?1, 1, ?2, NULL, ?3)`,
        )
        .bind(input.id, specJson, input.now),
    ]);

    return {
      ...input,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    };
  }

  async getDraft(id: string, ownerHash: string): Promise<DraftRecord | null> {
    const row = await this.database
      .prepare('SELECT * FROM drafts WHERE id = ?1 AND owner_hash = ?2 LIMIT 1')
      .bind(id, ownerHash)
      .first<DraftRow>();
    return row ? draftFrom(row) : null;
  }

  async listDrafts(ownerHash: string): Promise<DraftRecord[]> {
    const rows = await this.database
      .prepare(
        `SELECT * FROM drafts
          WHERE owner_hash = ?1
          ORDER BY updated_at DESC
          LIMIT 100`,
      )
      .bind(ownerHash)
      .all<DraftRow>();
    return rows.results.map(draftFrom);
  }

  async deleteDraft(id: string, ownerHash: string): Promise<boolean> {
    const results = await this.database.batch([
      this.database
        .prepare('DELETE FROM publications WHERE draft_id = ?1 AND owner_hash = ?2')
        .bind(id, ownerHash),
      this.database
        .prepare('DELETE FROM drafts WHERE id = ?1 AND owner_hash = ?2 RETURNING id')
        .bind(id, ownerHash),
    ]);
    const deleted = results[1]?.results as Array<{ id?: string }> | undefined;
    return deleted?.some((row) => row.id === id) ?? false;
  }

  async deleteExpiredDrafts(before: string, now: string, limit = 100): Promise<number> {
    const candidates = await this.database
      .prepare(
        `SELECT d.id, d.owner_hash
           FROM drafts d
          WHERE d.updated_at < ?1
            AND NOT EXISTS (
              SELECT 1 FROM publications p
               WHERE p.draft_id = d.id
                 AND p.revoked_at IS NULL
                 AND p.expires_at > ?2
            )
          ORDER BY d.updated_at ASC
          LIMIT ?3`,
      )
      .bind(before, now, limit)
      .all<{ id: string; owner_hash: string }>();
    let deleted = 0;
    for (const candidate of candidates.results) {
      const results = await this.database.batch([
        this.database
          .prepare(
            `DELETE FROM publications
              WHERE draft_id = ?1 AND owner_hash = ?2
                AND EXISTS (
                  SELECT 1 FROM drafts d
                   WHERE d.id = ?1 AND d.owner_hash = ?2 AND d.updated_at < ?3
                )
                AND NOT EXISTS (
                  SELECT 1 FROM publications active
                   WHERE active.draft_id = ?1
                     AND active.revoked_at IS NULL
                     AND active.expires_at > ?4
                )`,
          )
          .bind(candidate.id, candidate.owner_hash, before, now),
        this.database
          .prepare(
            `DELETE FROM drafts
              WHERE id = ?1 AND owner_hash = ?2 AND updated_at < ?3
                AND NOT EXISTS (
                  SELECT 1 FROM publications active
                   WHERE active.draft_id = ?1
                     AND active.revoked_at IS NULL
                     AND active.expires_at > ?4
                )`,
          )
          .bind(candidate.id, candidate.owner_hash, before, now),
      ]);
      deleted += results[1]?.meta.changes ?? 0;
    }
    return deleted;
  }

  async updateDraft(input: UpdateDraftInput): Promise<DraftRecord | null> {
    const nextVersion = input.expectedVersion + 1;
    const specJson = JSON.stringify(input.spec);
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO draft_versions (draft_id, version, spec_json, instruction, created_at)
           SELECT ?1, ?2, ?3, ?4, ?5
             FROM drafts
            WHERE id = ?1 AND owner_hash = ?6 AND version = ?7`,
        )
        .bind(
          input.id,
          nextVersion,
          specJson,
          input.instruction,
          input.now,
          input.ownerHash,
          input.expectedVersion,
        ),
      this.database
        .prepare(
          `UPDATE drafts
              SET title = ?1, schema_version = ?2, spec_json = ?3,
                  version = ?4, updated_at = ?5
            WHERE id = ?6 AND owner_hash = ?7 AND version = ?8`,
        )
        .bind(
          input.title,
          input.schemaVersion,
          specJson,
          nextVersion,
          input.now,
          input.id,
          input.ownerHash,
          input.expectedVersion,
        ),
      this.database
        .prepare(
          `DELETE FROM draft_versions
            WHERE draft_id = ?1
              AND version < (
                SELECT MAX(1, version - 24) FROM drafts
                 WHERE id = ?1 AND owner_hash = ?2
              )`,
        )
        .bind(input.id, input.ownerHash),
    ]);

    const updateResult = result[1];
    if (!updateResult || (updateResult.meta.changes ?? 0) !== 1) return null;
    return this.getDraft(input.id, input.ownerHash);
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const refreshPublication = async (
      publication: PublicationRecord,
    ): Promise<PublicationRecord | null> => {
      const refreshed = await this.database
        .prepare(
          `UPDATE publications
              SET title = ?1, schema_version = ?2, spec_json = ?3, expires_at = ?4
            WHERE slug = ?5 AND owner_hash = ?6 AND revoked_at IS NULL
              AND EXISTS (
                SELECT 1 FROM drafts
                 WHERE id = ?7 AND owner_hash = ?6 AND version = ?8
              )`,
        )
        .bind(
          input.draft.title,
          input.draft.schemaVersion,
          JSON.stringify(input.draft.spec),
          input.expiresAt,
          publication.slug,
          input.draft.ownerHash,
          input.draft.id,
          input.draft.version,
        )
        .run();
      if ((refreshed.meta.changes ?? 0) !== 1) return null;
      return {
        ...publication,
        title: input.draft.title,
        schemaVersion: input.draft.schemaVersion,
        spec: input.draft.spec,
        expiresAt: input.expiresAt,
      };
    };

    const existing = await this.getActivePublicationForDraft(
      input.draft.id,
      input.draft.ownerHash,
    );
    if (existing) {
      const refreshed = await refreshPublication(existing);
      if (refreshed) return { status: 'published', publication: refreshed };
      const current = await this.getDraft(input.draft.id, input.draft.ownerHash);
      if (!current || current.version !== input.draft.version) {
        return { status: 'version-conflict' };
      }
    }

    try {
      const inserted = await this.database
        .prepare(
          `INSERT INTO publications
             (slug, draft_id, owner_hash, title, schema_version, spec_json, created_at, expires_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
             FROM drafts
            WHERE id = ?2 AND owner_hash = ?3 AND version = ?9`,
        )
        .bind(
          input.slug,
          input.draft.id,
          input.draft.ownerHash,
          input.draft.title,
          input.draft.schemaVersion,
          JSON.stringify(input.draft.spec),
          input.now,
          input.expiresAt,
          input.draft.version,
        )
        .run();
      if ((inserted.meta.changes ?? 0) !== 1) return { status: 'version-conflict' };
    } catch (error) {
      const current = await this.getDraft(input.draft.id, input.draft.ownerHash);
      if (!current || current.version !== input.draft.version) {
        return { status: 'version-conflict' };
      }
      const concurrent = await this.getActivePublicationForDraft(
        input.draft.id,
        input.draft.ownerHash,
      );
      if (concurrent) {
        const refreshed = await refreshPublication(concurrent);
        if (refreshed) return { status: 'published', publication: refreshed };
        return { status: 'version-conflict' };
      }
      throw error;
    }

    return {
      status: 'published',
      publication: {
        slug: input.slug,
        draftId: input.draft.id,
        ownerHash: input.draft.ownerHash,
        title: input.draft.title,
        schemaVersion: input.draft.schemaVersion,
        spec: input.draft.spec,
        createdAt: input.now,
        expiresAt: input.expiresAt,
        revokedAt: null,
      },
    };
  }

  async getActivePublicationForDraft(
    draftId: string,
    ownerHash: string,
  ): Promise<PublicationRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT * FROM publications
          WHERE draft_id = ?1 AND owner_hash = ?2 AND revoked_at IS NULL
          LIMIT 1`,
      )
      .bind(draftId, ownerHash)
      .first<PublicationRow>();
    return row ? publicationFrom(row) : null;
  }

  async getPublication(slug: string): Promise<PublicationRecord | null> {
    const row = await this.database
      .prepare('SELECT * FROM publications WHERE slug = ?1 LIMIT 1')
      .bind(slug)
      .first<PublicationRow>();
    return row ? publicationFrom(row) : null;
  }

  async extendPublication(
    slug: string,
    ownerHash: string,
    now: string,
    days: number,
    maximumExpiresAt: string,
  ): Promise<ExtendPublicationResult> {
    const result = await this.database
      .prepare(
        `UPDATE publications
            SET expires_at = strftime(
              '%Y-%m-%dT%H:%M:%fZ',
              julianday(CASE WHEN expires_at > ?1 THEN expires_at ELSE ?1 END) + ?2
            )
          WHERE slug = ?3 AND owner_hash = ?4 AND revoked_at IS NULL
            AND julianday(CASE WHEN expires_at > ?1 THEN expires_at ELSE ?1 END) + ?2
                <= julianday(?5)
          RETURNING *`,
      )
      .bind(now, days, slug, ownerHash, maximumExpiresAt)
      .all<PublicationRow>();
    const extended = result.results[0];
    if (extended) return { status: 'extended', publication: publicationFrom(extended) };
    const existing = await this.getPublication(slug);
    if (!existing || existing.ownerHash !== ownerHash || existing.revokedAt) {
      return { status: 'not-found' };
    }
    return { status: 'expiry-limit' };
  }

  async revokePublication(slug: string, ownerHash: string, now: string): Promise<boolean> {
    const result = await this.database
      .prepare(
        `UPDATE publications SET revoked_at = COALESCE(revoked_at, ?1)
          WHERE slug = ?2 AND owner_hash = ?3`,
      )
      .bind(now, slug, ownerHash)
      .run();
    return (result.meta.changes ?? 0) === 1;
  }

  async createContentReport(input: ContentReportInput): Promise<boolean> {
    const result = await this.database
      .prepare(
        `INSERT INTO content_reports (id, publication_slug, reason, created_at)
         SELECT ?1, ?2, ?3, ?4
          WHERE (SELECT COUNT(*) FROM content_reports WHERE publication_slug = ?2) < ?5`,
      )
      .bind(
        input.id,
        input.publicationSlug,
        input.reason,
        input.now,
        input.maximumPerPublication,
      )
      .run();
    return (result.meta.changes ?? 0) === 1;
  }

  async deleteContentReports(before: string): Promise<number> {
    const result = await this.database
      .prepare('DELETE FROM content_reports WHERE created_at < ?1')
      .bind(before)
      .run();
    return result.meta.changes ?? 0;
  }
}
