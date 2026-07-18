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
