import { describe, expect, it, vi } from 'vitest';
import { CloudflareImageNormalizer } from '../src/imageNormalizer';

describe('Cloudflare image normalizer', () => {
  it('uses the Images binding to decode and re-encode a flattened static JPEG', async () => {
    const inputBytes = Uint8Array.from([1, 2, 3, 4]);
    const canonicalBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const output = vi.fn().mockResolvedValue({
      contentType: () => 'image/jpeg',
      image: () => new Response(canonicalBytes.buffer).body!,
    });
    const input = vi.fn().mockReturnValue({ output });
    const normalizer = new CloudflareImageNormalizer({ input } as unknown as ImagesBinding);

    await expect(normalizer.normalize(inputBytes, 'image/png')).resolves.toEqual(canonicalBytes);
    expect(input).toHaveBeenCalledOnce();
    expect(output).toHaveBeenCalledWith({
      format: 'image/jpeg',
      quality: 85,
      anim: false,
      background: '#ffffff',
    });
    const submitted = new Uint8Array(
      await new Response(input.mock.calls[0]?.[0] as ReadableStream<Uint8Array>).arrayBuffer(),
    );
    expect(submitted).toEqual(inputBytes);
  });

  it('fails closed when the Images binding cannot canonicalize the input', async () => {
    const input = vi.fn().mockReturnValue({
      output: vi.fn().mockRejectedValue(new Error('unsupported image')),
    });
    const normalizer = new CloudflareImageNormalizer({ input } as unknown as ImagesBinding);

    await expect(normalizer.normalize(Uint8Array.from([1]), 'image/webp')).rejects.toMatchObject({
      code: 'IMAGE_CANONICALISATION_FAILED',
    });
  });
});
