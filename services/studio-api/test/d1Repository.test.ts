import { describe, expect, it } from 'vitest';
import { D1StudioRepository } from '../src/storage/d1Repository';

describe('D1StudioRepository draft deletion', () => {
  it('uses RETURNING instead of unreliable batch change metadata', async () => {
    const statements: string[] = [];
    const database = {
      prepare(sql: string) {
        statements.push(sql);
        const statement = { bind: () => statement };
        return statement;
      },
      batch() {
        return Promise.resolve([
          { success: true, meta: { changes: 0 }, results: [] },
          { success: true, meta: { changes: 0 }, results: [{ id: 'draft-1' }] },
        ]);
      },
    } as unknown as D1Database;
    const repository = new D1StudioRepository(database);

    await expect(repository.deleteDraft('draft-1', 'owner-a')).resolves.toBe(true);
    expect(statements[1]).toContain('RETURNING id');
  });
});

describe('D1StudioRepository atomic publication writes', () => {
  it('inserts a publication only when the stored draft still has the moderated version', async () => {
    const statements: string[] = [];
    const bindings: unknown[][] = [];
    const database = {
      prepare(sql: string) {
        statements.push(sql);
        const statement = {
          bind(...values: unknown[]) {
            bindings.push(values);
            return statement;
          },
          first: () => Promise.resolve(null),
          run: () => Promise.resolve({ success: true, meta: { changes: 1 }, results: [] }),
        };
        return statement;
      },
    } as unknown as D1Database;
    const repository = new D1StudioRepository(database);
    const draft = {
      id: 'draft-1',
      ownerHash: 'owner-a',
      title: 'Forces retrieval',
      schemaVersion: '1.0',
      spec: { schemaVersion: '1.0' },
      version: 7,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    } as Parameters<typeof repository.publish>[0]['draft'];

    await expect(repository.publish({
      slug: 'publication-slug',
      draft,
      expiresAt: '2026-10-16T00:00:00.000Z',
      now: '2026-07-18T00:00:00.000Z',
    })).resolves.toMatchObject({ status: 'published' });

    expect(statements[1]).toContain('INSERT INTO publications');
    expect(statements[1]).toContain('FROM drafts');
    expect(statements[1]).toContain('version = ?9');
    expect(bindings[1]?.[8]).toBe(7);
  });

  it('uses one conditional UPDATE for cumulative extension and its maximum expiry', async () => {
    const statements: string[] = [];
    const bindings: unknown[][] = [];
    const publicationRow = {
      slug: 'publication-slug',
      draft_id: 'draft-1',
      owner_hash: 'owner-a',
      title: 'Forces retrieval',
      schema_version: '1.0',
      spec_json: JSON.stringify({ schemaVersion: '1.0' }),
      created_at: '2026-07-18T00:00:00.000Z',
      expires_at: '2026-10-26T00:00:00.000Z',
      revoked_at: null,
    };
    const database = {
      prepare(sql: string) {
        statements.push(sql);
        const statement = {
          bind(...values: unknown[]) {
            bindings.push(values);
            return statement;
          },
          all: () => Promise.resolve({ success: true, results: [publicationRow] }),
        };
        return statement;
      },
    } as unknown as D1Database;
    const repository = new D1StudioRepository(database);

    await expect(repository.extendPublication(
      'publication-slug',
      'owner-a',
      '2026-07-18T00:00:00.000Z',
      10,
      '2027-07-19T00:00:00.000Z',
    )).resolves.toMatchObject({ status: 'extended' });

    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('UPDATE publications');
    expect(statements[0]).toContain('julianday(CASE WHEN expires_at > ?1');
    expect(statements[0]).toContain('<= julianday(?5)');
    expect(statements[0]).toContain('RETURNING *');
    expect(bindings[0]).toEqual([
      '2026-07-18T00:00:00.000Z',
      10,
      'publication-slug',
      'owner-a',
      '2027-07-19T00:00:00.000Z',
    ]);
  });
});
