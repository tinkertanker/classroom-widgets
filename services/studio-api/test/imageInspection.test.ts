import { describe, expect, it } from 'vitest';
import { inspectImage } from '../src/imageInspection';
import { HttpError } from '../src/http';

const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
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

describe('image byte inspection', () => {
  it('reads dimensions from a real metadata-free PNG', () => {
    expect(inspectImage(decodeBase64(ONE_PIXEL_PNG), 'image/png')).toEqual({
      width: 1,
      height: 1,
    });
  });

  it('rejects bytes that do not match the declared media type', () => {
    expectHttpError(
      () => inspectImage(decodeBase64(ONE_PIXEL_PNG), 'image/jpeg'),
      'INVALID_IMAGE_BYTES',
    );
  });

  it('rejects PNG text metadata even when the image body is otherwise valid', () => {
    const source = new Uint8Array(decodeBase64(ONE_PIXEL_PNG));
    const metadataChunk = new Uint8Array([
      0, 0, 0, 0,
      't'.charCodeAt(0), 'E'.charCodeAt(0), 'X'.charCodeAt(0), 't'.charCodeAt(0),
      0, 0, 0, 0,
    ]);
    const withMetadata = new Uint8Array(source.length + metadataChunk.length);
    withMetadata.set(source.slice(0, 33));
    withMetadata.set(metadataChunk, 33);
    withMetadata.set(source.slice(33), 33 + metadataChunk.length);

    expectHttpError(() => inspectImage(withMetadata.buffer, 'image/png'), 'IMAGE_METADATA_PRESENT');
  });

  it('rejects a JPEG that is truncated after its dimensions', () => {
    const truncated = Uint8Array.from([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    ]);

    expectHttpError(() => inspectImage(truncated.buffer, 'image/jpeg'), 'INVALID_IMAGE_BYTES');
  });

  it('continues after JPEG dimensions and rejects later EXIF metadata', () => {
    const withExifAfterFrame = Uint8Array.from([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
      0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
      0x00, 0xff, 0xd9,
    ]);

    expectHttpError(
      () => inspectImage(withExifAfterFrame.buffer, 'image/jpeg'),
      'IMAGE_METADATA_PRESENT',
    );
  });
});
