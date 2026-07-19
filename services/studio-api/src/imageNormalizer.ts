import { HttpError } from './http';

const MAXIMUM_CANONICAL_BYTES = 2_000_000;

export interface ImageNormalizer {
  normalize(bytes: Uint8Array, mediaType: string): Promise<Uint8Array>;
}

export class CloudflareImageNormalizer implements ImageNormalizer {
  constructor(private readonly images: ImagesBinding) {}

  async normalize(bytes: Uint8Array, mediaType: string): Promise<Uint8Array> {
    try {
      const inputBytes = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const input = new Response(inputBytes, { headers: { 'content-type': mediaType } }).body;
      if (!input) throw new Error('Could not create an image input stream.');
      const result = await this.images.input(input).output({
        format: 'image/jpeg',
        quality: 85,
        anim: false,
        background: '#ffffff',
      });
      if (result.contentType().toLowerCase() !== 'image/jpeg') {
        throw new Error('The image service returned an unexpected media type.');
      }
      const canonical = new Uint8Array(await new Response(result.image()).arrayBuffer());
      if (canonical.byteLength < 1 || canonical.byteLength > MAXIMUM_CANONICAL_BYTES) {
        throw new Error('The canonical image is outside the permitted size range.');
      }
      return canonical;
    } catch (error) {
      const diagnostic = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error(`Image canonicalisation failed: ${diagnostic.slice(0, 500)}`);
      throw new HttpError(
        422,
        'IMAGE_CANONICALISATION_FAILED',
        'This image could not be safely normalised. Choose a different image and try again.',
      );
    }
  }
}
