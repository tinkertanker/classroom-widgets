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

function publishRequest(expectedVersion = 1, token = DEVICE_TOKEN): Request {
  return request(
    '/v1/drafts/draft-1/publish',
    'POST',
    { expectedVersion },
    token,
  );
}

function signedToken(
  ownerId: string,
  expiresAt = '2099-01-01T00:00:00.000Z',
): string {
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    ownerId,
    expiresAt: Date.parse(expiresAt),
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
  let provider: FixtureModelProvider;

  beforeEach(() => {
    repository = new MemoryStudioRepository();
    currentDate = new Date('2026-07-18T00:00:00.000Z');
    provider = new FixtureModelProvider();
    app = createStudioApp({
      repository,
      provider,
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

  it('refreshes an expired credential while preserving access to the same drafts', async () => {
    const expiringToken = signedToken(
      'teacher-owner-id-000000000000001',
      '2026-07-17T00:00:00.000Z',
    );
    currentDate = new Date('2026-07-16T00:00:00.000Z');
    expect((await app.fetch(request('/v1/drafts/generate', 'POST', validBrief(), expiringToken))).status).toBe(201);

    currentDate = new Date('2026-07-18T00:00:00.000Z');
    const expired = await app.fetch(request('/v1/drafts', 'GET', undefined, expiringToken));
    expect(expired.status).toBe(401);

    const response = await app.fetch(
      request('/v1/devices/refresh', 'POST', undefined, expiringToken),
    );
    const credential = await response.json() as { token: string; expiresAt: string };
    expect(response.status).toBe(200);
    expect(credential.expiresAt).toBe('2027-08-22T00:00:00.000Z');

    const restored = await app.fetch(request('/v1/drafts', 'GET', undefined, credential.token));
    const restoredBody = await restored.json() as { drafts: Array<{ id: string }> };
    expect(restored.status).toBe(200);
    expect(restoredBody.drafts).toEqual([expect.objectContaining({ id: 'draft-1' })]);
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
    await app.fetch(publishRequest());

    const response = await app.fetch(request('/v1/drafts'));
    const body = await response.json() as {
      drafts: Array<{
        id: string;
        title: string;
        publication: { slug: string; url: string } | null;
        publicationNeedsUpdate: boolean;
      }>;
    };
    expect(response.status).toBe(200);
    expect(body.drafts).toHaveLength(1);
    expect(body.drafts[0]).toMatchObject({
      id: 'draft-1',
      publication: {
        slug: PUBLICATION_SLUG,
        url: `https://play.example.test/${PUBLICATION_SLUG}`,
      },
      publicationNeedsUpdate: false,
    });

    const otherOwner = await app.fetch(
      request('/v1/drafts', 'GET', undefined, signedToken('different-owner-id-0000000000001')),
    );
    expect(await otherOwner.json()).toEqual({ drafts: [] });
  });

  it('marks a restored publication stale until the current draft is republished', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    await app.fetch(publishRequest());
    await app.fetch(
      request('/v1/drafts/draft-1/patch', 'POST', {
        instruction: 'Change the draft without updating the student link.',
        expectedVersion: 1,
      }),
    );

    const staleList = await app.fetch(request('/v1/drafts'));
    const staleBody = await staleList.json() as {
      drafts: Array<{ publicationNeedsUpdate: boolean }>;
    };
    expect(staleBody.drafts[0]?.publicationNeedsUpdate).toBe(true);

    await app.fetch(publishRequest(2));
    const currentList = await app.fetch(request('/v1/drafts'));
    const currentBody = await currentList.json() as {
      drafts: Array<{ publicationNeedsUpdate: boolean }>;
    };
    expect(currentBody.drafts[0]?.publicationNeedsUpdate).toBe(false);
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

  it('rejects a version approved on another iPad before moderation or publication', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    const revised = await app.fetch(
      request('/v1/drafts/draft-1/patch', 'POST', {
        instruction: 'Change the activity after another iPad reviewed it.',
        expectedVersion: 1,
      }),
    );
    expect(revised.status).toBe(200);

    let moderationCalls = 0;
    provider.moderate = async () => {
      moderationCalls += 1;
      return { safe: true, categories: [] };
    };
    const response = await app.fetch(publishRequest(1));
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('DRAFT_VERSION_CONFLICT');
    expect(moderationCalls).toBe(0);
    expect(repository.publications.size).toBe(0);
  });

  it('refuses to publish a stale snapshot when the draft changes during moderation', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    let moderationStarted!: () => void;
    let releaseModeration!: () => void;
    const started = new Promise<void>((resolve) => { moderationStarted = resolve; });
    const release = new Promise<void>((resolve) => { releaseModeration = resolve; });
    provider.moderate = async () => {
      moderationStarted();
      await release;
      return { safe: true, categories: [] };
    };

    const publishing = app.fetch(publishRequest());
    await started;
    const original = repository.drafts.get('draft-1');
    expect(original).toBeDefined();
    await repository.updateDraft({
      id: original!.id,
      ownerHash: original!.ownerHash,
      title: original!.title,
      schemaVersion: original!.schemaVersion,
      spec: {
        ...original!.spec,
        metadata: { ...original!.spec.metadata, summary: 'Changed during moderation.' },
      },
      expectedVersion: original!.version,
      instruction: 'Concurrent edit',
      now: currentDate.toISOString(),
    });
    releaseModeration();

    const response = await publishing;
    const body = await response.json() as { error: { code: string } };
    expect(response.status).toBe(409);
    expect(body.error.code).toBe('DRAFT_VERSION_CONFLICT');
    expect(repository.publications.size).toBe(0);
  });

  it('maps a draft race at the repository publication boundary to a version conflict', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    const originalPublish = repository.publish.bind(repository);
    repository.publish = async (input) => {
      await repository.updateDraft({
        id: input.draft.id,
        ownerHash: input.draft.ownerHash,
        title: input.draft.title,
        schemaVersion: input.draft.schemaVersion,
        spec: {
          ...input.draft.spec,
          metadata: { ...input.draft.spec.metadata, summary: 'Raced at persistence.' },
        },
        expectedVersion: input.draft.version,
        instruction: 'Concurrent edit at persistence',
        now: currentDate.toISOString(),
      });
      return originalPublish(input);
    };

    const response = await app.fetch(publishRequest());
    const body = await response.json() as { error: { code: string } };
    expect(response.status).toBe(409);
    expect(body.error.code).toBe('DRAFT_VERSION_CONFLICT');
    expect(repository.publications.size).toBe(0);
  });

  it('publishes, serves, extends and revokes one unlisted student URL', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    const publish = await app.fetch(publishRequest());
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
    const republish = await app.fetch(publishRequest(2));
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
    expect(extendBody.publication.expiresAt).toBe('2027-02-13T00:00:00.000Z');

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
    await app.fetch(publishRequest());

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
    await app.fetch(publishRequest());
    currentDate = new Date('2026-10-17T00:00:00.000Z');

    const response = await app.fetch(request(`/v1/publications/${PUBLICATION_SLUG}`));
    const body = await response.json() as { error: { code: string; message: string } };
    expect(response.status).toBe(410);
    expect(body.error.code).toBe('PUBLICATION_EXPIRED');
    expect(body.error.message).toContain('Ask the teacher');
  });

  it('extends an expired publication from today rather than its old expiry', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    await app.fetch(publishRequest());
    currentDate = new Date('2026-10-20T00:00:00.000Z');

    const response = await app.fetch(
      request(`/v1/publications/${PUBLICATION_SLUG}`, 'PATCH', { days: 10 }),
    );
    const body = await response.json() as { publication: { expiresAt: string } };
    expect(response.status).toBe(200);
    expect(body.publication.expiresAt).toBe('2026-10-30T00:00:00.000Z');
  });

  it('caps cumulative publication extensions at token expiry plus the recovery window', async () => {
    const boundedToken = signedToken(
      'teacher-owner-id-000000000000001',
      '2026-07-19T00:00:00.000Z',
    );
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief(), boundedToken));
    await app.fetch(publishRequest(1, boundedToken));

    const first = await app.fetch(
      request(`/v1/publications/${PUBLICATION_SLUG}`, 'PATCH', { days: 180 }, boundedToken),
    );
    expect(first.status).toBe(200);
    expect((await first.json() as { publication: { expiresAt: string } }).publication.expiresAt)
      .toBe('2027-04-14T00:00:00.000Z');

    const second = await app.fetch(
      request(`/v1/publications/${PUBLICATION_SLUG}`, 'PATCH', { days: 180 }, boundedToken),
    );
    const body = await second.json() as { error: { code: string } };
    expect(second.status).toBe(422);
    expect(body.error.code).toBe('PUBLICATION_EXPIRY_LIMIT_REACHED');
    expect((await repository.getPublication(PUBLICATION_SLUG))?.expiresAt)
      .toBe('2027-04-14T00:00:00.000Z');
  });

  it('does not permit an unlisted caller to revoke another teacher’s publication', async () => {
    await app.fetch(request('/v1/drafts/generate', 'POST', validBrief()));
    await app.fetch(publishRequest());

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
    await app.fetch(publishRequest());

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
