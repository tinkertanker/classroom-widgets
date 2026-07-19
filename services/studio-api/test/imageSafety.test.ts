import { describe, expect, it, vi } from 'vitest';
import { CloudflareImageSafetyInspector } from '../src/imageSafety';
import { HttpError } from '../src/http';

describe('image safety review', () => {
  it('accepts an explicitly safe classroom image classification', async () => {
    const run = vi.fn().mockResolvedValue({
      result: { answer: 'SAFE\nA labelled force diagram.' },
      usage: { total_tokens: 42 },
    });
    const inspector = new CloudflareImageSafetyInspector({ run });

    await expect(inspector.inspect(new Uint8Array([1, 2, 3]), 'image/png')).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledWith(
      '@cf/moondream/moondream3.1-9B-A2B',
      expect.objectContaining({ task: 'query', stream: false, reasoning: false }),
    );
  });

  it('rejects people, personal data or unsafe pixels and fails closed on outages', async () => {
    const unsafe = new CloudflareImageSafetyInspector({
      run: vi.fn().mockResolvedValue({ answer: 'UNSAFE\nA pupil face is visible.' }),
    });
    await expect(unsafe.inspect(new Uint8Array([1]), 'image/jpeg')).rejects.toMatchObject({
      status: 422,
      code: 'IMAGE_NOT_ALLOWED',
    } satisfies Partial<HttpError>);

    const unavailable = new CloudflareImageSafetyInspector({
      run: vi.fn().mockRejectedValue(new Error('offline')),
    });
    await expect(unavailable.inspect(new Uint8Array([1]), 'image/jpeg')).rejects.toMatchObject({
      status: 503,
      code: 'IMAGE_SAFETY_REVIEW_UNAVAILABLE',
    } satisfies Partial<HttpError>);
  });
});
