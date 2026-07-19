import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
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

const ONE_PIXEL_CANONICAL_JPEG = Uint8Array.from([
  0xff, 0xd8,
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0x00, 0xff, 0xd9,
]);

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

  it('persists only canonical JPEG bytes and metadata after normalizing an upload', async () => {
    const source = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    );
    const payload = new TextEncoder().encode('private pupil note');
    const privateChunk = pngChunk('prIV', payload);
    const upload = new Uint8Array(source.length + privateChunk.length);
    upload.set(source.slice(0, 33));
    upload.set(privateChunk, 33);
    upload.set(source.slice(33), 33 + privateChunk.length);

    const bucketPut = vi.fn().mockResolvedValue(undefined);
    const normalize = vi.fn().mockResolvedValue(ONE_PIXEL_CANONICAL_JPEG);
    const imageInspect = vi.fn().mockResolvedValue(undefined);
    const database = {
      prepare(sql: string) {
        const statement = {
          bind() { return statement; },
          first() {
            return Promise.resolve(
              sql.includes('COUNT(*) AS asset_count')
                ? { asset_count: 0, total_bytes: 0 }
                : null,
            );
          },
          run() { return Promise.resolve({ meta: { changes: 1 } }); },
        };
        return statement;
      },
    } as unknown as D1Database;
    const store = new CloudflareAssetStore(
      database,
      { put: bucketPut, delete: vi.fn() } as unknown as R2Bucket,
      { normalize },
      { inspect: imageInspect },
    );
    const incomingHash = createHash('sha256').update(upload).digest('hex');

    const record = await store.put(
      new Request('https://api.example.test/v1/assets', {
        method: 'POST',
        headers: {
          'content-type': 'image/png',
          'x-image-width': '1',
          'x-image-height': '1',
          'x-image-decorative': 'true',
          'x-image-sha256': incomingHash,
        },
        body: upload,
      }),
      {
        ownerHash: 'owner-a',
        networkHash: 'network-a',
        now: '2026-07-18T00:00:00.000Z',
        maximumNetworkCount: 100,
        maximumNetworkBytes: 10_000_000,
      },
    );

    const storedBytes = bucketPut.mock.calls[0]?.[1] as Uint8Array;
    const storedOptions = bucketPut.mock.calls[0]?.[2] as {
      customMetadata: { sha256: string };
    };
    const canonicalHash = createHash('sha256').update(ONE_PIXEL_CANONICAL_JPEG).digest('hex');
    expect(normalize).toHaveBeenCalledWith(upload, 'image/png');
    expect(storedBytes).toEqual(ONE_PIXEL_CANONICAL_JPEG);
    expect(storedBytes).not.toEqual(upload);
    expect(new TextDecoder().decode(storedBytes)).not.toContain('private pupil note');
    expect(imageInspect).toHaveBeenCalledWith(ONE_PIXEL_CANONICAL_JPEG, 'image/jpeg');
    expect(record.contentType).toBe('image/jpeg');
    expect(record.byteLength).toBe(ONE_PIXEL_CANONICAL_JPEG.byteLength);
    expect(record.byteLength).not.toBe(upload.byteLength);
    expect(record.sha256).toBe(canonicalHash);
    expect(storedOptions.customMetadata.sha256).toBe(canonicalHash);
    expect(record.sha256).not.toBe(incomingHash);
  });

  it('fails closed when the injected normalizer returns malformed output', async () => {
    const bucketPut = vi.fn();
    const imageInspect = vi.fn();
    const store = new CloudflareAssetStore(
      fakeDatabase([]),
      { put: bucketPut } as unknown as R2Bucket,
      { normalize: vi.fn().mockResolvedValue(new TextEncoder().encode('not a JPEG')) },
      { inspect: imageInspect },
    );

    const request = new Request('https://api.example.test/v1/assets', {
      method: 'POST',
      headers: {
        'content-type': 'image/png',
        'x-image-width': '1',
        'x-image-height': '1',
        'x-image-decorative': 'true',
      },
      body: Uint8Array.from([1, 2, 3]),
    });

    await expect(store.put(request, {
      ownerHash: 'owner-a',
      networkHash: 'network-a',
      now: '2026-07-18T00:00:00.000Z',
      maximumNetworkCount: 100,
      maximumNetworkBytes: 10_000_000,
    })).rejects.toMatchObject({ code: 'INVALID_IMAGE_BYTES' });
    expect(imageInspect).not.toHaveBeenCalled();
    expect(bucketPut).not.toHaveBeenCalled();
  });

  it('reserves owner and network quotas before image canonicalisation', async () => {
    const events: string[] = [];
    const database = {
      prepare(sql: string) {
        const statement = {
          bind() { return statement; },
          run() {
            if (sql.includes('INSERT INTO asset_usage')) events.push('quota');
            return Promise.resolve({ meta: { changes: 1 } });
          },
        };
        return statement;
      },
    } as unknown as D1Database;
    const normalize = vi.fn().mockImplementation(async () => {
      events.push('normalise');
      return ONE_PIXEL_CANONICAL_JPEG;
    });
    const store = new CloudflareAssetStore(
      database,
      { put: vi.fn() } as unknown as R2Bucket,
      { normalize },
      { inspect: vi.fn() },
    );

    const upload = Uint8Array.from([1, 2, 3]);
    const request = new Request('https://api.example.test/v1/assets', {
      method: 'POST',
      headers: {
        'content-type': 'image/png',
        'x-image-width': '2',
        'x-image-height': '1',
        'x-image-decorative': 'true',
      },
      body: upload,
    });

    await expect(store.put(request, {
      ownerHash: 'owner-a',
      networkHash: 'network-a',
      now: '2026-07-18T00:00:00.000Z',
      maximumNetworkCount: 100,
      maximumNetworkBytes: 10_000_000,
    })).rejects.toMatchObject({ code: 'IMAGE_DIMENSIONS_MISMATCH' });
    expect(events).toEqual(['quota', 'quota', 'normalise']);
  });
});

function pngChunk(type: string, payload: Uint8Array): Uint8Array {
  const result = new Uint8Array(12 + payload.length);
  const typeBytes = new TextEncoder().encode(type);
  new DataView(result.buffer).setUint32(0, payload.length, false);
  result.set(typeBytes, 4);
  result.set(payload, 8);
  const checksumInput = new Uint8Array(typeBytes.length + payload.length);
  checksumInput.set(typeBytes);
  checksumInput.set(payload, typeBytes.length);
  new DataView(result.buffer).setUint32(8 + payload.length, crc32(checksumInput), false);
  return result;
}

function crc32(bytes: Uint8Array): number {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
    }
  }
  return (checksum ^ 0xffffffff) >>> 0;
}
