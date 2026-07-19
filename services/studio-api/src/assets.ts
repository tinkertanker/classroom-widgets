import { HttpError, readBodyBytes } from './http';
import { inspectCanonicalJpeg } from './imageInspection';
import type { ImageSafetyInspector } from './imageSafety';
import type { ImageNormalizer } from './imageNormalizer';
import { inspectText } from './moderation';

const MAXIMUM_ASSET_BYTES = 2_000_000;
const MAXIMUM_DAILY_ASSETS = 12;
const MAXIMUM_DAILY_ASSET_BYTES = 20_000_000;
const MAXIMUM_STORED_ASSETS = 50;
const MAXIMUM_STORED_ASSET_BYTES = 50_000_000;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface AssetRecord {
  id: string;
  ownerHash: string;
  objectKey: string;
  contentType: string;
  byteLength: number;
  width: number;
  height: number;
  sha256: string;
  alternativeText: string | null;
  decorative: boolean;
  createdAt: string;
}

export interface StoredAsset {
  record: AssetRecord;
  object: R2ObjectBody;
}

export interface AssetStore {
  put(
    request: Request,
    context: {
      ownerHash: string;
      networkHash: string;
      now: string;
      maximumNetworkCount: number;
      maximumNetworkBytes: number;
    },
  ): Promise<AssetRecord>;
  get(id: string): Promise<StoredAsset | null>;
  deleteOwned(id: string, ownerHash: string): Promise<'deleted' | 'in-use' | 'missing'>;
  cleanupOrphans(before: string, now: string, limit?: number): Promise<number>;
}

interface AssetRow {
  id: string;
  owner_hash: string;
  object_key: string;
  content_type: string;
  byte_length: number;
  width: number;
  height: number;
  sha256: string;
  alternative_text: string | null;
  decorative: number;
  created_at: string;
}

function positiveIntegerHeader(request: Request, name: string, maximum: number): number {
  const rawValue = request.headers.get(name) ?? '';
  const value = Number(rawValue);
  if (!/^\d+$/.test(rawValue) || !Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new HttpError(422, 'INVALID_IMAGE_METADATA', `${name} is invalid.`);
  }
  return value;
}

function assetFrom(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    ownerHash: row.owner_hash,
    objectKey: row.object_key,
    contentType: row.content_type,
    byteLength: row.byte_length,
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    alternativeText: row.alternative_text,
    decorative: row.decorative === 1,
    createdAt: row.created_at,
  };
}

function imageAlternativeText(request: Request): string | null {
  const encoded = request.headers.get('x-image-alt-base64');
  if (!encoded) return request.headers.get('x-image-alt')?.trim() || null;
  try {
    const bytes = Uint8Array.from(atob(encoded), (value) => value.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim() || null;
  } catch {
    throw new HttpError(422, 'INVALID_ALTERNATIVE_TEXT', 'The image description is invalid.');
  }
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomAssetId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `asset-${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export class CloudflareAssetStore implements AssetStore {
  constructor(
    private readonly database: D1Database,
    private readonly bucket: R2Bucket,
    private readonly normalizer?: ImageNormalizer,
    private readonly imageSafety?: ImageSafetyInspector,
  ) {}

  async put(
    request: Request,
    context: {
      ownerHash: string;
      networkHash: string;
      now: string;
      maximumNetworkCount: number;
      maximumNetworkBytes: number;
    },
  ): Promise<AssetRecord> {
    const { ownerHash, networkHash, now, maximumNetworkCount, maximumNetworkBytes } = context;
    const contentType = (request.headers.get('content-type') ?? '').toLowerCase().split(';')[0];
    if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw new HttpError(
        415,
        'UNSUPPORTED_IMAGE_TYPE',
        'Upload a processed JPEG, PNG or WebP image.',
      );
    }

    const declaredLength = request.headers.get('content-length');
    if (
      declaredLength !== null &&
      (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAXIMUM_ASSET_BYTES)
    ) {
      throw new HttpError(413, 'IMAGE_TOO_LARGE', 'Processed images must be 2 MB or smaller.');
    }

    const width = positiveIntegerHeader(request, 'x-image-width', 4_096);
    const height = positiveIntegerHeader(request, 'x-image-height', 4_096);
    const decorative = request.headers.get('x-image-decorative') === 'true';
    const alternativeText = imageAlternativeText(request);
    if (!decorative && !alternativeText) {
      throw new HttpError(
        422,
        'ALTERNATIVE_TEXT_REQUIRED',
        'Describe the image or mark it as decorative.',
      );
    }
    if (alternativeText && alternativeText.length > 500) {
      throw new HttpError(422, 'ALTERNATIVE_TEXT_TOO_LONG', 'Image descriptions must be 500 characters or fewer.');
    }
    if (alternativeText && inspectText(alternativeText).length > 0) {
      throw new HttpError(
        422,
        'POSSIBLE_PERSONAL_DATA',
        'Remove possible personal information from the image description.',
      );
    }

    const bytes = await readBodyBytes(
      request,
      MAXIMUM_ASSET_BYTES,
      () => new HttpError(413, 'IMAGE_TOO_LARGE', 'Processed images must be 2 MB or smaller.'),
    );
    if (bytes.byteLength === 0 || bytes.byteLength > MAXIMUM_ASSET_BYTES) {
      throw new HttpError(413, 'IMAGE_TOO_LARGE', 'Processed images must be between 1 byte and 2 MB.');
    }
    const originalDigest = hex(
      await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer),
    );
    const suppliedHash = request.headers.get('x-image-sha256')?.toLowerCase();
    if (suppliedHash && suppliedHash !== originalDigest) {
      throw new HttpError(422, 'IMAGE_HASH_MISMATCH', 'The image did not upload intact.');
    }

    // Reserve both allowances before the paid decode/re-encode. Rejected dimensions,
    // malformed canonical output and storage-full owners still consume one attempt,
    // preventing callers from using Cloudflare Images without meeting a quota.
    const usageDate = now.slice(0, 10);
    const ownerAllowed = await this.consumeUsage(
      ownerHash,
      usageDate,
      bytes.byteLength,
      MAXIMUM_DAILY_ASSETS,
      MAXIMUM_DAILY_ASSET_BYTES,
    );
    if (!ownerAllowed) {
      throw new HttpError(
        429,
        'DAILY_ASSET_LIMIT_REACHED',
        'This device has reached today’s image upload limit.',
      );
    }
    const networkAllowed = await this.consumeUsage(
      `network:${networkHash}`,
      usageDate,
      bytes.byteLength,
      maximumNetworkCount,
      maximumNetworkBytes,
    );
    if (!networkAllowed) {
      throw new HttpError(
        429,
        'NETWORK_ASSET_LIMIT_REACHED',
        'This network has reached today’s image upload safety limit.',
      );
    }

    if (!this.normalizer) {
      throw new HttpError(
        503,
        'IMAGE_NORMALISATION_UNAVAILABLE',
        'Image normalisation is temporarily unavailable. Try again shortly.',
      );
    }
    const canonicalBytes = await this.normalizer.normalize(bytes, contentType);
    if (canonicalBytes.byteLength < 1 || canonicalBytes.byteLength > MAXIMUM_ASSET_BYTES) {
      throw new HttpError(
        422,
        'IMAGE_CANONICALISATION_FAILED',
        'This image could not be safely normalised. Choose a different image and try again.',
      );
    }
    const inspected = inspectCanonicalJpeg(
      canonicalBytes.buffer.slice(
        canonicalBytes.byteOffset,
        canonicalBytes.byteOffset + canonicalBytes.byteLength,
      ) as ArrayBuffer,
    );
    if (inspected.width !== width || inspected.height !== height) {
      throw new HttpError(
        422,
        'IMAGE_DIMENSIONS_MISMATCH',
        'The declared image dimensions do not match the processed image.',
      );
    }
    const stored = await this.database
      .prepare(
        `SELECT COUNT(*) AS asset_count, COALESCE(SUM(byte_length), 0) AS total_bytes
           FROM assets WHERE owner_hash = ?1`,
      )
      .bind(ownerHash)
      .first<{ asset_count: number; total_bytes: number }>();
    if (
      (stored?.asset_count ?? 0) >= MAXIMUM_STORED_ASSETS ||
      (stored?.total_bytes ?? 0) + canonicalBytes.byteLength > MAXIMUM_STORED_ASSET_BYTES
    ) {
      throw new HttpError(
        429,
        'ASSET_STORAGE_LIMIT_REACHED',
        'This device has reached its image storage limit. Remove unused images before uploading more.',
      );
    }

    const digestInput = canonicalBytes.buffer.slice(
      canonicalBytes.byteOffset,
      canonicalBytes.byteOffset + canonicalBytes.byteLength,
    ) as ArrayBuffer;
    const sha256 = hex(await crypto.subtle.digest('SHA-256', digestInput));

    // Safety inference is also after quota reservation. Rejected images consume
    // one upload allowance because paid processing has already been requested.
    if (!this.imageSafety) {
      throw new HttpError(
        503,
        'IMAGE_SAFETY_REVIEW_UNAVAILABLE',
        'The image safety check is temporarily unavailable. Try again shortly.',
      );
    }
    await this.imageSafety.inspect(canonicalBytes, 'image/jpeg');

    const id = randomAssetId();
    const canonicalContentType = 'image/jpeg';
    const objectKey = `assets/${ownerHash.slice(0, 12)}/${id}.jpg`;
    await this.bucket.put(objectKey, canonicalBytes, {
      httpMetadata: { contentType: canonicalContentType, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { sha256, width: String(width), height: String(height) },
    });

    try {
      await this.database
        .prepare(
          `INSERT INTO assets
             (id, owner_hash, object_key, content_type, byte_length, width, height,
              sha256, alternative_text, decorative, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
        )
        .bind(
          id,
          ownerHash,
          objectKey,
          canonicalContentType,
          canonicalBytes.byteLength,
          width,
          height,
          sha256,
          alternativeText,
          decorative ? 1 : 0,
          now,
        )
        .run();
    } catch (error) {
      await this.bucket.delete(objectKey);
      throw error;
    }

    return {
      id,
      ownerHash,
      objectKey,
      contentType: canonicalContentType,
      byteLength: canonicalBytes.byteLength,
      width,
      height,
      sha256,
      alternativeText,
      decorative,
      createdAt: now,
    };
  }

  async get(id: string): Promise<StoredAsset | null> {
    const row = await this.database
      .prepare('SELECT * FROM assets WHERE id = ?1 LIMIT 1')
      .bind(id)
      .first<AssetRow>();
    if (!row) return null;
    const object = await this.bucket.get(row.object_key);
    return object ? { record: assetFrom(row), object } : null;
  }

  async deleteOwned(
    id: string,
    ownerHash: string,
  ): Promise<'deleted' | 'in-use' | 'missing'> {
    const row = await this.database
      .prepare('SELECT * FROM assets WHERE id = ?1 AND owner_hash = ?2 LIMIT 1')
      .bind(id, ownerHash)
      .first<AssetRow>();
    if (!row) return 'missing';
    const now = new Date().toISOString();
    const result = await this.database
      .prepare(
        `DELETE FROM assets
          WHERE id = ?1 AND owner_hash = ?2
            AND NOT EXISTS (
              SELECT 1 FROM drafts d
               WHERE d.owner_hash = ?2
                 AND instr(d.spec_json, '"' || ?1 || '"') > 0
            )
            AND NOT EXISTS (
              SELECT 1 FROM publications p
               WHERE p.owner_hash = ?2
                 AND p.revoked_at IS NULL
                 AND p.expires_at > ?3
                 AND instr(p.spec_json, '"' || ?1 || '"') > 0
            )`,
      )
      .bind(id, ownerHash, now)
      .run();
    if ((result.meta.changes ?? 0) !== 1) return 'in-use';
    await this.bucket.delete(row.object_key);
    return 'deleted';
  }

  async cleanupOrphans(before: string, now: string, limit = 100): Promise<number> {
    const rows = await this.database
      .prepare(
        `SELECT a.* FROM assets a
          WHERE a.created_at < ?1
            AND NOT EXISTS (
              SELECT 1 FROM drafts d
               WHERE d.owner_hash = a.owner_hash
                 AND instr(d.spec_json, '"' || a.id || '"') > 0
            )
            AND NOT EXISTS (
              SELECT 1 FROM publications p
               WHERE p.owner_hash = a.owner_hash
                 AND p.revoked_at IS NULL
                 AND p.expires_at > ?2
                 AND instr(p.spec_json, '"' || a.id || '"') > 0
            )
          ORDER BY a.created_at ASC
          LIMIT ?3`,
      )
      .bind(before, now, limit)
      .all<AssetRow>();
    let deleted = 0;
    for (const row of rows.results) {
      const result = await this.database
        .prepare(
          `DELETE FROM assets
            WHERE id = ?1 AND owner_hash = ?2
              AND NOT EXISTS (
                SELECT 1 FROM drafts d
                 WHERE d.owner_hash = ?2
                   AND instr(d.spec_json, '"' || ?1 || '"') > 0
              )
              AND NOT EXISTS (
                SELECT 1 FROM publications p
                 WHERE p.owner_hash = ?2
                   AND p.revoked_at IS NULL
                   AND p.expires_at > ?3
                   AND instr(p.spec_json, '"' || ?1 || '"') > 0
              )`,
        )
        .bind(row.id, row.owner_hash, now)
        .run();
      if ((result.meta.changes ?? 0) === 1) {
        await this.bucket.delete(row.object_key);
        deleted += 1;
      }
    }
    return deleted;
  }

  async cleanupUsage(beforeDate: string): Promise<void> {
    await this.database
      .prepare('DELETE FROM asset_usage WHERE usage_date < ?1')
      .bind(beforeDate)
      .run();
  }

  private async consumeUsage(
    subject: string,
    usageDate: string,
    byteLength: number,
    maximumCount: number,
    maximumBytes: number,
  ): Promise<boolean> {
    const result = await this.database
      .prepare(
        `INSERT INTO asset_usage (owner_hash, usage_date, upload_count, total_bytes)
         VALUES (?1, ?2, 1, ?3)
         ON CONFLICT(owner_hash, usage_date)
         DO UPDATE SET
           upload_count = upload_count + 1,
           total_bytes = total_bytes + ?3
         WHERE upload_count < ?4 AND total_bytes + ?3 <= ?5`,
      )
      .bind(subject, usageDate, byteLength, maximumCount, maximumBytes)
      .run();
    return (result.meta.changes ?? 0) === 1;
  }
}
