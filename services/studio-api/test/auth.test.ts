import { describe, expect, it } from 'vitest';
import {
  deviceTokenFrom,
  issueDeviceToken,
  ownerCredentialFrom,
  ownerHashFrom,
  randomSlug,
  refreshDeviceToken,
  sha256,
} from '../src/auth';
import { HttpError } from '../src/http';

describe('device ownership', () => {
  it('accepts a high-entropy device token', () => {
    const request = new Request('https://studio.test/v1/drafts', {
      headers: { 'x-device-token': 'A'.repeat(32) },
    });
    expect(deviceTokenFrom(request)).toBe('A'.repeat(32));
  });

  it('rejects missing and short tokens', () => {
    const request = new Request('https://studio.test/v1/drafts');
    expect(() => deviceTokenFrom(request)).toThrowError(HttpError);
  });

  it('hashes tokens deterministically without retaining the token', async () => {
    const digest = await sha256('A'.repeat(32));
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(await sha256('A'.repeat(32)));
    expect(digest).not.toContain('AAAA');
  });

  it('issues a signed owner token, rejects tampering and expires it', async () => {
    const secret = 'test-device-signing-secret-with-at-least-32-characters';
    const issuedAt = new Date('2026-07-18T00:00:00.000Z');
    const credential = await issueDeviceToken(secret, issuedAt, 1);
    const request = new Request('https://studio.test/v1/drafts', {
      headers: { 'x-device-token': credential.token },
    });

    await expect(ownerHashFrom(request, secret, issuedAt.getTime())).resolves.toMatch(/^[a-f0-9]{64}$/);
    const replacement = credential.token.endsWith('A') ? 'B' : 'A';
    const tampered = new Request('https://studio.test/v1/drafts', {
      headers: { 'x-device-token': `${credential.token.slice(0, -1)}${replacement}` },
    });
    await expect(ownerHashFrom(tampered, secret, issuedAt.getTime())).rejects.toMatchObject({
      code: 'DEVICE_REGISTRATION_REQUIRED',
    });
    await expect(
      ownerHashFrom(request, secret, issuedAt.getTime() + 2 * 86_400_000),
    ).rejects.toMatchObject({ code: 'DEVICE_REGISTRATION_REQUIRED' });
  });

  it('refreshes a recently expired signed token without changing its owner', async () => {
    const secret = 'test-device-signing-secret-with-at-least-32-characters';
    const issuedAt = new Date('2026-07-18T00:00:00.000Z');
    const refreshAt = new Date('2027-07-18T00:00:00.000Z');
    const original = await issueDeviceToken(secret, issuedAt, 1);
    const originalRequest = new Request('https://studio.test/v1/devices/refresh', {
      headers: { 'x-device-token': original.token },
    });

    await expect(
      ownerHashFrom(originalRequest, secret, refreshAt.getTime()),
    ).rejects.toMatchObject({ code: 'DEVICE_REGISTRATION_REQUIRED' });

    const refreshed = await refreshDeviceToken(originalRequest, secret, refreshAt, 400);
    const refreshedRequest = new Request('https://studio.test/v1/drafts', {
      headers: { 'x-device-token': refreshed.token },
    });

    expect(refreshed.expiresAt).toBe('2028-08-21T00:00:00.000Z');
    await expect(ownerHashFrom(refreshedRequest, secret, refreshAt.getTime())).resolves.toBe(
      await ownerHashFrom(originalRequest, secret, issuedAt.getTime()),
    );
  });

  it('rejects token recovery after the 365-day recovery window', async () => {
    const secret = 'test-device-signing-secret-with-at-least-32-characters';
    const issuedAt = new Date('2025-07-17T00:00:00.000Z');
    const original = await issueDeviceToken(secret, issuedAt, 1);
    const request = new Request('https://studio.test/v1/devices/refresh', {
      headers: { 'x-device-token': original.token },
    });

    await expect(
      refreshDeviceToken(request, secret, new Date('2026-07-19T00:00:00.000Z')),
    ).rejects.toMatchObject({ code: 'DEVICE_REGISTRATION_REQUIRED' });
  });

  it('exposes the verified owner expiry while rejecting expired normal operations', async () => {
    const secret = 'test-device-signing-secret-with-at-least-32-characters';
    const issuedAt = new Date('2026-07-18T00:00:00.000Z');
    const original = await issueDeviceToken(secret, issuedAt, 1);
    const request = new Request('https://studio.test/v1/drafts', {
      headers: { 'x-device-token': original.token },
    });

    await expect(ownerCredentialFrom(request, secret, issuedAt.getTime())).resolves.toMatchObject({
      ownerHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: Date.parse('2026-07-19T00:00:00.000Z'),
    });
    await expect(
      ownerCredentialFrom(request, secret, Date.parse('2026-07-19T00:00:00.000Z')),
    ).rejects.toMatchObject({ code: 'DEVICE_REGISTRATION_REQUIRED' });
  });

  it('creates URL-safe, high-entropy publication slugs', () => {
    const slugs = new Set(Array.from({ length: 200 }, () => randomSlug()));
    expect(slugs.size).toBe(200);
    for (const slug of slugs) expect(slug).toMatch(/^[A-Za-z0-9_-]{20}$/);
  });
});
