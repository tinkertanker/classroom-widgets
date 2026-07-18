import { describe, expect, it, vi } from 'vitest';
import { CloudflareAssetStore } from '../src/assets';

const ASSET_ROW = {
  id: 'asset-0123456789abcdef0123456789abcdef',
  owner_hash: 'owner-a',
  object_key: 'assets/owner-a/example.png',
  content_type: 'image/png',
  byte_length: 128,
  width: 1,
  height: 1,
  sha256: 'a'.repeat(64),
  alternative_text: 'A diagram',
  decorative: 0,
  created_at: '2026-01-01T00:00:00.000Z',
};

function fakeDatabase(statements: string[]): D1Database {
  return {
    prepare(sql: string) {
      statements.push(sql);
      const statement = {
        bind() { return statement; },
        first() { return Promise.resolve(ASSET_ROW); },
        run() { return Promise.resolve({ meta: { changes: 1 } }); },
        all() { return Promise.resolve({ results: [ASSET_ROW] }); },
      };
      return statement;
    },
  } as unknown as D1Database;
}

describe('asset reference ownership', () => {
  it('scopes deletion guards to the asset owner', async () => {
    const statements: string[] = [];
    const bucketDelete = vi.fn().mockResolvedValue(undefined);
    const store = new CloudflareAssetStore(
      fakeDatabase(statements),
      { delete: bucketDelete } as unknown as R2Bucket,
    );

    await expect(store.deleteOwned(ASSET_ROW.id, ASSET_ROW.owner_hash)).resolves.toBe('deleted');
    expect(statements[1]).toContain('d.owner_hash = ?2');
    expect(statements[1]).toContain('p.owner_hash = ?2');
    expect(bucketDelete).toHaveBeenCalledWith(ASSET_ROW.object_key);
  });

  it('uses correlated owner guards during orphan selection and final deletion', async () => {
    const statements: string[] = [];
    const store = new CloudflareAssetStore(
      fakeDatabase(statements),
      { delete: vi.fn().mockResolvedValue(undefined) } as unknown as R2Bucket,
    );

    await expect(store.cleanupOrphans(
      '2026-02-01T00:00:00.000Z',
      '2026-03-01T00:00:00.000Z',
    )).resolves.toBe(1);
    expect(statements[0]).toContain('d.owner_hash = a.owner_hash');
    expect(statements[0]).toContain('p.owner_hash = a.owner_hash');
    expect(statements[1]).toContain('d.owner_hash = ?2');
    expect(statements[1]).toContain('p.owner_hash = ?2');
  });
});
