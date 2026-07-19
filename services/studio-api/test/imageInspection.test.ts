import { describe, expect, it } from 'vitest';
import { inspectCanonicalJpeg } from '../src/imageInspection';
import { HttpError } from '../src/http';

export const ONE_PIXEL_CANONICAL_JPEG = Uint8Array.from([
  0xff, 0xd8,
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0x00, 0xff, 0xd9,
]);

function inspect(bytes: Uint8Array) {
  return inspectCanonicalJpeg(bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer);
}

function expectHttpError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('Expected an HttpError.');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ code });
  }
}

describe('canonical JPEG inspection', () => {
  it('reads dimensions only after a complete JPEG scan', () => {
    expect(inspect(ONE_PIXEL_CANONICAL_JPEG)).toEqual({ width: 1, height: 1 });
  });

  it('rejects output truncated after its dimensions', () => {
    expectHttpError(
      () => inspect(ONE_PIXEL_CANONICAL_JPEG.slice(0, 15)),
      'INVALID_IMAGE_BYTES',
    );
  });

  it('rejects unexpected metadata in normalizer output', () => {
    const metadata = Uint8Array.from([
      0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    ]);
    const withMetadata = new Uint8Array(ONE_PIXEL_CANONICAL_JPEG.length + metadata.length);
    withMetadata.set(ONE_PIXEL_CANONICAL_JPEG.slice(0, 15));
    withMetadata.set(metadata, 15);
    withMetadata.set(ONE_PIXEL_CANONICAL_JPEG.slice(15), 15 + metadata.length);

    expectHttpError(() => inspect(withMetadata), 'IMAGE_METADATA_PRESENT');
  });
});
