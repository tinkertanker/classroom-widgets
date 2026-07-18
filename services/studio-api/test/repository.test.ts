import { describe, expect, it } from 'vitest';
import type { WidgetSpec } from '@classroom-widgets/widget-spec';
import { MemoryStudioRepository } from '../src/storage/memoryRepository';

const fixture = {
  schemaVersion: '1.0',
  id: 'fixture',
  metadata: { title: 'Forces retrieval' },
  screens: [],
} as unknown as WidgetSpec;

describe('MemoryStudioRepository', () => {
  it('enforces the daily generation limit without an off-by-one', async () => {
    const repository = new MemoryStudioRepository();
    expect(await repository.consumeGeneration('owner', '2026-07-18', 2)).toBe(true);
    expect(await repository.consumeGeneration('owner', '2026-07-18', 2)).toBe(true);
    expect(await repository.consumeGeneration('owner', '2026-07-18', 2)).toBe(false);
    expect(await repository.consumeGeneration('owner', '2026-07-19', 2)).toBe(true);
  });

  it('consumes a one-use pilot code exactly once before it expires', async () => {
    const repository = new MemoryStudioRepository();
    repository.pilotCodes.set('pilot-code-hash', {
      maximumUses: 1,
      uses: 0,
      expiresAt: '2026-07-19T00:00:00.000Z',
    });

    expect(
      await repository.consumePilotCode('pilot-code-hash', '2026-07-18T00:00:00.000Z'),
    ).toBe(true);
    expect(
      await repository.consumePilotCode('pilot-code-hash', '2026-07-18T00:00:01.000Z'),
    ).toBe(false);
    expect(repository.pilotCodes.get('pilot-code-hash')?.uses).toBe(1);
  });

  it('keeps drafts private to their device owner', async () => {
    const repository = new MemoryStudioRepository();
    await repository.createDraft({
      id: 'draft-1',
      ownerHash: 'owner-a',
      title: 'Forces retrieval',
      schemaVersion: '1.0',
      spec: fixture,
      now: '2026-07-18T00:00:00.000Z',
    });

    expect(await repository.getDraft('draft-1', 'owner-a')).not.toBeNull();
    expect(await repository.getDraft('draft-1', 'owner-b')).toBeNull();
    expect((await repository.listDrafts('owner-a')).map((draft) => draft.id)).toEqual(['draft-1']);
    expect(await repository.listDrafts('owner-b')).toEqual([]);
  });

  it('rejects a stale patch instead of overwriting a newer version', async () => {
    const repository = new MemoryStudioRepository();
    await repository.createDraft({
      id: 'draft-1',
      ownerHash: 'owner-a',
      title: 'Forces retrieval',
      schemaVersion: '1.0',
      spec: fixture,
      now: '2026-07-18T00:00:00.000Z',
    });

    const first = await repository.updateDraft({
      id: 'draft-1',
      ownerHash: 'owner-a',
      title: 'Balanced forces retrieval',
      schemaVersion: '1.0',
      spec: fixture,
      expectedVersion: 1,
      instruction: 'Focus on balanced forces.',
      now: '2026-07-18T00:01:00.000Z',
    });
    expect(first?.version).toBe(2);

    const stale = await repository.updateDraft({
      id: 'draft-1',
      ownerHash: 'owner-a',
      title: 'Stale title',
      schemaVersion: '1.0',
      spec: fixture,
      expectedVersion: 1,
      instruction: 'Overwrite it.',
      now: '2026-07-18T00:02:00.000Z',
    });
    expect(stale).toBeNull();
  });

  it('revokes only for the owning device and makes owner retries idempotent', async () => {
    const repository = new MemoryStudioRepository();
    const draft = await repository.createDraft({
      id: 'draft-1',
      ownerHash: 'owner-a',
      title: 'Forces retrieval',
      schemaVersion: '1.0',
      spec: fixture,
      now: '2026-07-18T00:00:00.000Z',
    });
    await repository.publish({
      slug: 'publication-slug',
      draft,
      expiresAt: '2026-10-16T00:00:00.000Z',
      now: '2026-07-18T00:00:00.000Z',
    });

    expect(
      await repository.revokePublication(
        'publication-slug',
        'owner-b',
        '2026-07-18T00:01:00.000Z',
      ),
    ).toBe(false);
    expect(
      await repository.revokePublication(
        'publication-slug',
        'owner-a',
        '2026-07-18T00:01:00.000Z',
      ),
    ).toBe(true);
    expect(
      await repository.revokePublication(
        'publication-slug',
        'owner-a',
        '2026-07-18T00:02:00.000Z',
      ),
    ).toBe(true);
  });

  it('expires stale drafts but preserves one with a live publication', async () => {
    const repository = new MemoryStudioRepository();
    const stale = await repository.createDraft({
      id: 'stale-draft',
      ownerHash: 'owner-a',
      title: 'Old widget',
      schemaVersion: '1.0',
      spec: fixture,
      now: '2025-01-01T00:00:00.000Z',
    });
    const live = await repository.createDraft({
      id: 'live-draft',
      ownerHash: 'owner-a',
      title: 'Published widget',
      schemaVersion: '1.0',
      spec: fixture,
      now: '2025-01-01T00:00:00.000Z',
    });
    await repository.publish({
      slug: 'live-publication',
      draft: live,
      expiresAt: '2026-08-01T00:00:00.000Z',
      now: '2026-01-01T00:00:00.000Z',
    });

    expect(
      await repository.deleteExpiredDrafts(
        '2026-01-01T00:00:00.000Z',
        '2026-07-18T00:00:00.000Z',
      ),
    ).toBe(1);
    expect(await repository.getDraft(stale.id, stale.ownerHash)).toBeNull();
    expect(await repository.getDraft(live.id, live.ownerHash)).not.toBeNull();
  });
});
