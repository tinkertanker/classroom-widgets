import { beforeEach, describe, expect, it } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { FixtureModelProvider } from '../src/ai/fixtureProvider';
import { createStudioApp } from '../src/app';
import { MemoryStudioRepository } from '../src/storage/memoryRepository';

const SIGNING_SECRET = 'test-device-signing-secret-with-at-least-32-characters';
const DEVICE_TOKEN = signedToken('teacher-owner-id-000000000000001');
const PUBLICATION_SLUG = 'ABCDEFGHIJKLMNOPQRST';

function request(path: string, method = 'GET', body?: unknown, token = DEVICE_TOKEN): Request {
  return new Request(`https://api.example.test${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      'x-device-token': token,
      origin: 'https://studio.example.test',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function signedToken(ownerId: string): string {
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    ownerId,
    expiresAt: Date.parse('2099-01-01T00:00:00.000Z'),
  })).toString('base64url');
  const signature = createHmac('sha256', SIGNING_SECRET).update(payload).digest('base64url');
  return `cw1.${payload}.${signature}`;
}

function validBrief() {
  return {
    level: 'Secondary 1',
    subject: 'Science',
    learningObjective: 'Explain what balanced forces do to a stationary object.',
    studentAction: 'Choose an answer and read immediate feedback.',
    durationMinutes: 5,
  };
}

describe('Studio API', () => {
  let repository: MemoryStudioRepository;
  let currentDate: Date;
  let app: ReturnType<typeof createStudioApp>;

  beforeEach(() => {
    repository = new MemoryStudioRepository();
    currentDate = new Date('2026-07-18T00:00:00.000Z');
    app = createStudioApp({
      repository,
      provider: new FixtureModelProvider(),
      config: {
        publicPlayerOrigin: 'https://play.example.test',
        allowedOrigins: new Set(['https://studio.example.test']),
        dailyGenerationLimit: 20,
        dailyNetworkGenerationLimit: 1_000,
        dailySafetyReviewLimit: 50,
        dailyNetworkSafetyReviewLimit: 1_000,
        dailyNetworkUploadLimit: 1_000,
        dailyNetworkUploadBytes: 200_000_000,
        dailyDraftCreationLimit: 50,
        dailyNetworkDraftCreationLimit: 500,
        maximumDraftsPerOwner: 100,
        dailyNetworkRegistrationLimit: 50,
        publicationTtlDays: 90,
        deviceTokenSigningSecret: SIGNING_SECRET,
      },
      now: () => currentDate,
      createId: () => 'draft-1',
      createSlug: () => PUBLICATION_SLUG,
    });
  });

  it('registers one iPad with a valid pilot access code and rejects reuse', async () => {
    const accessCode = 'WORKSHOP-2026';
    const codeHash = createHash('sha256')
      .update(`pilot-code:${accessCode}`)
      .digest('hex');
    repository.pilotCodes.set(codeHash, {
      maximumUses: 1,
      uses: 0,
      expiresAt: '2026-07-19T00:00:00.000Z',
    });

    const registration = await app.fetch(
      request('/v1/devices/register', 'POST', { accessCode: accessCode.toLowerCase() }),
    );
    const credential = await registration.json() as { token: string; expiresAt: string };

    expect(registration.status).toBe(201);
    expect(credential.token).toMatch(/^cw1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
    expect(credential.expiresAt).toBe('2027-08-22T00:00:00.000Z');

    const authorised = await app.fetch(
      request('/v1/drafts/missing-draft', 'GET', undefined, credential.token),
    );
    expect(authorised.status).toBe(404);

    const reused = await app.fetch(
      request('/v1/devices/register', 'POST', { accessCode }),
    );
    const reusedBody = await reused.json() as { error: { code: string } };
    expect(reused.status).toBe(403);
    expect(reusedBody.error.code).toBe('INVALID_ACCESS_CODE');
  });

  it('generates a private, validated draft from a guided brief', async () => {
    const response = await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    const body = await response.json() as {
      draft: { id: string; version: number; spec: { schemaVersion: string } };
      provider: string;
    };

    expect(response.status).toBe(201);
    expect(body.draft.id).toBe('draft-1');
    expect(body.draft.version).toBe(1);
    expect(body.draft.spec.schemaVersion).toBe('1.0');
    expect(body.provider).toBe('fixture');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://studio.example.test');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toContain('X-Device-Token');

    const wrongOwner = await app.fetch(
      request('/v1/drafts/draft-1', 'GET', undefined, signedToken('different-owner-id-0000000000001')),
    );
    expect(wrongOwner.status).toBe(404);
  });

  it('lists owned drafts and their publication so a restored iPad can recover them', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    await app.fetch(request('/v1/drafts/draft-1/publish', 'POST'));

    const response = await app.fetch(request('/v1/drafts'));
    const body = await response.json() as {
      drafts: Array<{ id: string; title: string; publication: { slug: string; url: string } | null }>;
    };
    expect(response.status).toBe(200);
    expect(body.drafts).toHaveLength(1);
    expect(body.drafts[0]).toMatchObject({
      id: 'draft-1',
      publication: {
        slug: PUBLICATION_SLUG,
        url: `https://play.example.test/${PUBLICATION_SLUG}`,
      },
    });

    const otherOwner = await app.fetch(
      request('/v1/drafts', 'GET', undefined, signedToken('different-owner-id-0000000000001')),
    );
    expect(await otherOwner.json()).toEqual({ drafts: [] });
  });

  it('rejects likely personal data before calling the model', async () => {
    const response = await app.fetch(
      request('/v1/drafts/generate', 'POST', {
        ...validBrief(),
        content: 'Contact pupil@example.com for the answer.',
      }),
    );
    const body = await response.json() as { error: { code: string } };
    expect(response.status).toBe(422);
    expect(body.error.code).toBe('POSSIBLE_PERSONAL_DATA');
    expect(repository.drafts.size).toBe(0);
  });

  it('rejects explicit requests for harmful instructions before calling the model', async () => {
    const response = await app.fetch(
      request('/v1/drafts/generate', 'POST', {
        ...validBrief(),
        studentAction: 'Provide a step-by-step guide to make a bomb.',
      }),
    );
    const body = await response.json() as { error: { code: string } };
    expect(response.status).toBe(422);
    expect(body.error.code).toBe('UNSAFE_CONTENT');
    expect(repository.drafts.size).toBe(0);
  });

  it('applies a revision as a new optimistic version', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    const response = await app.fetch(
      request('/v1/drafts/draft-1/patch', 'POST', {
        instruction: 'Make the summary more explicit.',
        expectedVersion: 1,
      }),
    );
    const body = await response.json() as {
      draft: { version: number; spec: { metadata: { summary: string } } };
    };
    expect(response.status).toBe(200);
    expect(body.draft.version).toBe(2);
    expect(body.draft.spec.metadata.summary).toContain('Make the summary more explicit.');

    const stale = await app.fetch(
      request('/v1/drafts/draft-1/patch', 'POST', {
        instruction: 'Overwrite the new version.',
        expectedVersion: 1,
      }),
    );
    expect(stale.status).toBe(409);
  });

  it('publishes, serves, extends and revokes one unlisted student URL', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    const publish = await app.fetch(request('/v1/drafts/draft-1/publish', 'POST'));
    const publishBody = await publish.json() as {
      publication: { slug: string; url: string; expiresAt: string };
    };
    expect(publish.status).toBe(201);
    expect(publishBody.publication.slug).toBe(PUBLICATION_SLUG);
    expect(publishBody.publication.url).toBe(`https://play.example.test/${PUBLICATION_SLUG}`);
    expect(publishBody.publication.expiresAt).toBe('2026-10-16T00:00:00.000Z');

    const publicResponse = await app.fetch(request(`/v1/publications/${PUBLICATION_SLUG}`));
    const publicBody = await publicResponse.json() as { status: string; spec: unknown };
    expect(publicResponse.status).toBe(200);
    expect(publicBody.status).toBe('available');
    expect(publicBody.spec).toBeTruthy();
    expect(publicResponse.headers.get('cache-control')).toBe('private, no-store');

    const revise = await app.fetch(
      request('/v1/drafts/draft-1/patch', 'POST', {
        instruction: 'Make the explanation more explicit.',
        expectedVersion: 1,
      }),
    );
    expect(revise.status).toBe(200);
    const republish = await app.fetch(request('/v1/drafts/draft-1/publish', 'POST'));
    const republishBody = await republish.json() as {
      publication: { slug: string };
    };
    expect(republishBody.publication.slug).toBe(PUBLICATION_SLUG);
    expect(repository.publications.size).toBe(1);

    const refreshed = await app.fetch(request(`/v1/publications/${PUBLICATION_SLUG}`));
    const refreshedBody = await refreshed.json() as {
      spec: { metadata: { summary: string } };
    };
    expect(refreshedBody.spec.metadata.summary).toContain('Make the explanation more explicit.');

    const extend = await app.fetch(
      request(`/v1/publications/${PUBLICATION_SLUG}`, 'PATCH', { days: 120 }),
    );
    const extendBody = await extend.json() as { publication: { expiresAt: string } };
    expect(extend.status).toBe(200);
    expect(extendBody.publication.expiresAt).toBe('2026-11-15T00:00:00.000Z');

    const revoke = await app.fetch(request(`/v1/publications/${PUBLICATION_SLUG}`, 'DELETE'));
    expect(revoke.status).toBe(204);
    const revokeRetry = await app.fetch(request(`/v1/publications/${PUBLICATION_SLUG}`, 'DELETE'));
    expect(revokeRetry.status).toBe(204);

    const unavailable = await app.fetch(request(`/v1/publications/${PUBLICATION_SLUG}`));
    const unavailableBody = await unavailable.json() as { error: { code: string; message: string } };
    expect(unavailable.status).toBe(410);
    expect(unavailableBody.error.code).toBe('PUBLICATION_REVOKED');
    expect(unavailableBody.error.message).toContain('unpublished');
  });

  it('accepts an anonymous, bounded content report without student text or identity', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    await app.fetch(request('/v1/drafts/draft-1/publish', 'POST'));

    const response = await app.fetch(
      request(`/v1/publications/${PUBLICATION_SLUG}/reports`, 'POST', {
        reason: 'personal-data',
      }),
    );
    expect(response.status).toBe(204);
    expect(repository.contentReports).toHaveLength(1);
    expect(repository.contentReports[0]).toMatchObject({
      publicationSlug: PUBLICATION_SLUG,
      reason: 'personal-data',
    });

    const invalid = await app.fetch(
      request(`/v1/publications/${PUBLICATION_SLUG}/reports`, 'POST', {
        reason: 'free-form-student-message',
      }),
    );
    expect(invalid.status).toBe(422);
    expect(repository.contentReports).toHaveLength(1);
  });

  it('returns a friendly expired response', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    await app.fetch(request('/v1/drafts/draft-1/publish', 'POST'));
    currentDate = new Date('2026-10-17T00:00:00.000Z');

    const response = await app.fetch(request(`/v1/publications/${PUBLICATION_SLUG}`));
    const body = await response.json() as { error: { code: string; message: string } };
    expect(response.status).toBe(410);
    expect(body.error.code).toBe('PUBLICATION_EXPIRED');
    expect(body.error.message).toContain('Ask the teacher');
  });

  it('does not permit an unlisted caller to revoke another teacher’s publication', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    await app.fetch(request('/v1/drafts/draft-1/publish', 'POST'));

    const response = await app.fetch(
      request(
        `/v1/publications/${PUBLICATION_SLUG}`,
        'DELETE',
        undefined,
        signedToken('different-owner-id-0000000000001'),
      ),
    );
    expect(response.status).toBe(404);
    expect((await repository.getPublication(PUBLICATION_SLUG))?.revokedAt).toBeNull();
  });

  it('deletes an owned draft and its published snapshot everywhere', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    await app.fetch(request('/v1/drafts/draft-1/publish', 'POST'));

    const wrongOwner = await app.fetch(
      request('/v1/drafts/draft-1', 'DELETE', undefined, signedToken('different-owner-id-0000000000001')),
    );
    expect(wrongOwner.status).toBe(404);
    expect(repository.drafts.has('draft-1')).toBe(true);

    const deleted = await app.fetch(request('/v1/drafts/draft-1', 'DELETE'));
    expect(deleted.status).toBe(204);
    expect(repository.drafts.has('draft-1')).toBe(false);
    expect(repository.publications.has(PUBLICATION_SLUG)).toBe(false);

    const publicResponse = await app.fetch(request(`/v1/publications/${PUBLICATION_SLUG}`));
    expect(publicResponse.status).toBe(404);
  });
});
