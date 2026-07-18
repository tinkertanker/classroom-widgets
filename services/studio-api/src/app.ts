import { validateWidgetSpec, type WidgetSpec } from '@classroom-widgets/widget-spec';
import type { ModelProvider, TeacherBrief } from './ai/provider';
import { ModelProviderError } from './ai/provider';
import type { AssetStore, StoredAsset } from './assets';
import { issueDeviceToken, networkHashFrom, ownerHashFrom, randomSlug, sha256 } from './auth';
import type { StudioConfig } from './env';
import {
  generateWidgetSpec,
  InvalidModelOutputError,
  patchWidgetSpec,
  repairWidgetSpec,
} from './generation';
import {
  apiError,
  corsHeaders,
  HttpError,
  json,
  readJson,
  withCors,
} from './http';
import {
  inspectTeacherBrief,
  inspectText,
  inspectUnknownText,
  inspectWidgetSpec,
  type ModerationFinding,
} from './moderation';
import type { DraftRecord, PublicationRecord, StudioRepository } from './storage/repository';
import type { ContentReportReason } from './storage/repository';

interface StudioAppDependencies {
  repository: StudioRepository;
  provider: ModelProvider;
  config: StudioConfig;
  assets?: AssetStore;
  now?: () => Date;
  createId?: () => string;
  createSlug?: () => string;
}

interface GenerateBody extends TeacherBrief {}

interface PatchBody {
  instruction: string;
  expectedVersion: number;
}

interface RepairBody {
  candidate: unknown;
}

interface ImportBody {
  spec: unknown;
}

interface SaveBody {
  spec: unknown;
  expectedVersion: number;
  note?: string;
}

interface ExtendBody {
  days?: number;
}

interface ReportBody {
  reason: ContentReportReason;
}

interface RegisterBody {
  accessCode: string;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const SAFE_SLUG = /^[A-Za-z0-9_-]{16,64}$/;
const CONTENT_REPORT_REASONS = new Set<ContentReportReason>([
  'inappropriate',
  'personal-data',
  'copyright',
  'accessibility',
  'other',
]);

function draftResponse(draft: DraftRecord) {
  return {
    id: draft.id,
    title: draft.title,
    schemaVersion: draft.schemaVersion,
    spec: draft.spec,
    version: draft.version,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

function draftSummaryResponse(
  draft: DraftRecord,
  publication: PublicationRecord | null,
  publicPlayerOrigin: string,
) {
  return {
    id: draft.id,
    title: draft.title,
    schemaVersion: draft.schemaVersion,
    version: draft.version,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    publication: publication
      ? publicationResponse(publication, publicPlayerOrigin)
      : null,
  };
}

function publicationResponse(publication: PublicationRecord, publicPlayerOrigin: string) {
  return {
    slug: publication.slug,
    url: `${publicPlayerOrigin}/${publication.slug}`,
    title: publication.title,
    schemaVersion: publication.schemaVersion,
    createdAt: publication.createdAt,
    expiresAt: publication.expiresAt,
    revokedAt: publication.revokedAt,
  };
}

function requiredString(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(422, 'INVALID_BRIEF', `${label} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maximum) {
    throw new HttpError(422, 'INVALID_BRIEF', `${label} is too long.`);
  }
  return trimmed;
}

function optionalString(value: unknown, label: string, maximum: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredString(value, label, maximum);
}

function objectBody<T extends object>(value: unknown): T {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'INVALID_BODY', 'The request body must be a JSON object.');
  }
  return value as T;
}

function parseBrief(body: GenerateBody): TeacherBrief {
  const durationMinutes = body.durationMinutes;
  if (
    durationMinutes !== undefined &&
    (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 120)
  ) {
    throw new HttpError(422, 'INVALID_BRIEF', 'Duration must be between 1 and 120 minutes.');
  }

  return {
    level: requiredString(body.level, 'Level', 100),
    subject: requiredString(body.subject, 'Subject', 100),
    learningObjective: requiredString(body.learningObjective, 'Learning objective', 600),
    studentAction: requiredString(body.studentAction, 'Student action', 600),
    content: optionalString(body.content, 'Content', 4_000),
    feedback: optionalString(body.feedback, 'Feedback', 1_000),
    durationMinutes,
    accessibilityNeeds: optionalString(body.accessibilityNeeds, 'Accessibility needs', 1_000),
  };
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString();
}

function imageResponse(asset: StoredAsset): Response {
  const headers = new Headers();
  asset.object.writeHttpMetadata(headers);
  headers.set('etag', asset.object.httpEtag);
  headers.set('cache-control', 'private, no-store');
  headers.set('cross-origin-resource-policy', 'same-origin');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(asset.object.body, { headers });
}

function rejectModerationFindings(findings: ModerationFinding[]): void {
  if (findings.length === 0) return;
  const personalData = findings.some((finding) => finding.code.startsWith('POSSIBLE_'));
  throw new HttpError(
    422,
    personalData ? 'POSSIBLE_PERSONAL_DATA' : 'UNSAFE_CONTENT',
    personalData
      ? 'Remove possible personal information before continuing.'
      : findings[0]?.message ?? 'This request cannot be processed safely.',
    findings,
  );
}

export function createStudioApp(dependencies: StudioAppDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const createSlug = dependencies.createSlug ?? (() => randomSlug());

  async function consumeGenerationQuota(
    request: Request,
    ownerHash: string,
    timestamp: Date,
  ): Promise<void> {
    const usageDate = timestamp.toISOString().slice(0, 10);
    // Reserve the narrow owner allowance first. An exhausted device must never consume
    // the shared school/NAT allowance merely by retrying rejected requests.
    const ownerAllowed = await dependencies.repository.consumeGeneration(
      `generation:${ownerHash}`,
      usageDate,
      dependencies.config.dailyGenerationLimit,
    );
    if (!ownerAllowed) {
      throw new HttpError(429, 'GENERATION_LIMIT_REACHED', 'Today’s generation limit has been reached.');
    }
    const networkAllowed = await dependencies.repository.consumeGeneration(
      `network-generation:${await networkHashFrom(request)}`,
      usageDate,
      dependencies.config.dailyNetworkGenerationLimit,
    );
    if (!networkAllowed) {
      throw new HttpError(
        429,
        'NETWORK_GENERATION_LIMIT_REACHED',
        'This network has reached its generation safety limit for today.',
      );
    }
  }

  async function consumeDraftCreationQuota(
    request: Request,
    ownerHash: string,
    timestamp: Date,
  ): Promise<void> {
    if (await dependencies.repository.countDrafts(ownerHash) >= dependencies.config.maximumDraftsPerOwner) {
      throw new HttpError(
        429,
        'DRAFT_STORAGE_LIMIT_REACHED',
        'This device has reached its saved widget limit. Delete an old widget before making another.',
      );
    }
    const usageDate = timestamp.toISOString().slice(0, 10);
    const ownerAllowed = await dependencies.repository.consumeGeneration(
      `draft:${ownerHash}`,
      usageDate,
      dependencies.config.dailyDraftCreationLimit,
    );
    if (!ownerAllowed) {
      throw new HttpError(429, 'DRAFT_LIMIT_REACHED', 'Today’s new widget limit has been reached.');
    }
    const networkAllowed = await dependencies.repository.consumeGeneration(
      `network-draft:${await networkHashFrom(request)}`,
      usageDate,
      dependencies.config.dailyNetworkDraftCreationLimit,
    );
    if (!networkAllowed) {
      throw new HttpError(
        429,
        'NETWORK_DRAFT_LIMIT_REACHED',
        'This network has reached its saved widget safety limit for today.',
      );
    }
  }

  async function consumeSafetyReviewQuota(
    request: Request,
    ownerHash: string,
    timestamp: Date,
  ): Promise<void> {
    const usageDate = timestamp.toISOString().slice(0, 10);
    const ownerAllowed = await dependencies.repository.consumeGeneration(
      `safety:${ownerHash}`,
      usageDate,
      dependencies.config.dailySafetyReviewLimit,
    );
    if (!ownerAllowed) {
      throw new HttpError(
        429,
        'SAFETY_REVIEW_LIMIT_REACHED',
        'Today’s publishing safety limit has been reached.',
      );
    }
    const networkAllowed = await dependencies.repository.consumeGeneration(
      `network-safety:${await networkHashFrom(request)}`,
      usageDate,
      dependencies.config.dailyNetworkSafetyReviewLimit,
    );
    if (!networkAllowed) {
      throw new HttpError(
        429,
        'NETWORK_SAFETY_REVIEW_LIMIT_REACHED',
        'This network has reached its publishing safety limit for today.',
      );
    }
  }

  async function validatedOwnedSpec(input: unknown, ownerHash: string): Promise<WidgetSpec> {
    const validation = validateWidgetSpec(input);
    if (!validation.valid) {
      throw new HttpError(
        422,
        'INVALID_WIDGET_SPEC',
        'Resolve validation issues before saving this widget.',
        validation.errors,
      );
    }
    if (new TextEncoder().encode(JSON.stringify(validation.value)).byteLength > 256_000) {
      throw new HttpError(413, 'WIDGET_SPEC_TOO_LARGE', 'This widget is too large to save safely.');
    }
    rejectModerationFindings(inspectWidgetSpec(validation.value));
    if (validation.value.assets.length === 0) return validation.value;
    if (!dependencies.assets) {
      throw new HttpError(503, 'ASSET_STORE_UNAVAILABLE', 'Images are unavailable.');
    }
    for (const declared of validation.value.assets) {
      const stored = await dependencies.assets.get(declared.id);
      if (
        !stored ||
        stored.record.ownerHash !== ownerHash ||
        stored.record.contentType !== declared.mediaType ||
        stored.record.width !== declared.width ||
        stored.record.height !== declared.height ||
        stored.record.byteLength !== declared.byteLength ||
        stored.record.sha256 !== declared.sha256
      ) {
        throw new HttpError(
          422,
          'INVALID_WIDGET_ASSET',
          `Image “${declared.id}” is missing or does not match this device’s upload.`,
        );
      }
    }
    return validation.value;
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);

    if (request.method === 'OPTIONS') {
      const headers = corsHeaders(request, dependencies.config);
      if (Object.keys(headers).length === 0) {
        return apiError(403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed.');
      }
      return new Response(null, { status: 204, headers });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'classroom-widgets-studio-api' });
    }

    if (request.method === 'POST' && url.pathname === '/v1/devices/register') {
      const body = objectBody<RegisterBody>(await readJson<unknown>(request, 1_000));
      const accessCode = requiredString(body.accessCode, 'Workshop access code', 80).toUpperCase();
      if (!/^[A-Z0-9-]{8,80}$/.test(accessCode)) {
        throw new HttpError(403, 'INVALID_ACCESS_CODE', 'This workshop access code is not valid.');
      }
      const timestamp = now();
      const usageDate = timestamp.toISOString().slice(0, 10);
      const networkAllowed = await dependencies.repository.consumeGeneration(
        `registration:${await networkHashFrom(request)}`,
        usageDate,
        dependencies.config.dailyNetworkRegistrationLimit,
      );
      if (!networkAllowed) {
        throw new HttpError(
          429,
          'REGISTRATION_LIMIT_REACHED',
          'This network has reached today’s workshop registration limit.',
        );
      }
      const codeHash = await sha256(`pilot-code:${accessCode}`);
      if (!await dependencies.repository.consumePilotCode(codeHash, timestamp.toISOString())) {
        throw new HttpError(403, 'INVALID_ACCESS_CODE', 'This workshop access code is invalid or has already been used.');
      }
      const credential = await issueDeviceToken(
        dependencies.config.deviceTokenSigningSecret,
        timestamp,
      );
      return json(credential, { status: 201 });
    }

    if (request.method === 'POST' && url.pathname === '/v1/drafts/generate') {
      const ownerHash = await ownerHashFrom(request, dependencies.config.deviceTokenSigningSecret, now().getTime());
      const brief = parseBrief(
        objectBody<GenerateBody>(await readJson<unknown>(request, 16_000)),
      );
      const findings = inspectTeacherBrief(brief);
      rejectModerationFindings(findings);

      const timestamp = now();
      await consumeDraftCreationQuota(request, ownerHash, timestamp);
      await consumeGenerationQuota(request, ownerHash, timestamp);

      const spec = await generateWidgetSpec(dependencies.provider, brief);
      await validatedOwnedSpec(spec, ownerHash);
      const created = await dependencies.repository.createDraft({
        id: createId(),
        ownerHash,
        title: spec.metadata.title,
        schemaVersion: spec.schemaVersion,
        spec,
        now: timestamp.toISOString(),
      });
      return json({ draft: draftResponse(created), provider: dependencies.provider.name }, { status: 201 });
    }

    if (request.method === 'GET' && url.pathname === '/v1/drafts') {
      const ownerHash = await ownerHashFrom(request, dependencies.config.deviceTokenSigningSecret, now().getTime());
      const drafts = await dependencies.repository.listDrafts(ownerHash);
      const summaries = await Promise.all(
        drafts.map(async (draft) => draftSummaryResponse(
          draft,
          await dependencies.repository.getActivePublicationForDraft(draft.id, ownerHash),
          dependencies.config.publicPlayerOrigin,
        )),
      );
      return json({ drafts: summaries });
    }

    if (request.method === 'POST' && url.pathname === '/v1/drafts') {
      const ownerHash = await ownerHashFrom(request, dependencies.config.deviceTokenSigningSecret, now().getTime());
      const timestamp = now();
      await consumeDraftCreationQuota(request, ownerHash, timestamp);
      const body = objectBody<ImportBody>(await readJson<unknown>(request, 300_000));
      const spec = await validatedOwnedSpec(body.spec, ownerHash);
      const created = await dependencies.repository.createDraft({
        id: createId(),
        ownerHash,
        title: spec.metadata.title,
        schemaVersion: spec.schemaVersion,
        spec,
        now: timestamp.toISOString(),
      });
      return json({ draft: draftResponse(created) }, { status: 201 });
    }

    if (segments[0] === 'v1' && segments[1] === 'assets' && segments.length === 2) {
      if (request.method !== 'POST') return apiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      if (!dependencies.assets) throw new HttpError(503, 'ASSET_STORE_UNAVAILABLE', 'Image uploads are unavailable.');
      const ownerHash = await ownerHashFrom(request, dependencies.config.deviceTokenSigningSecret, now().getTime());
      const asset = await dependencies.assets.put(request, {
        ownerHash,
        networkHash: await networkHashFrom(request),
        now: now().toISOString(),
        maximumNetworkCount: dependencies.config.dailyNetworkUploadLimit,
        maximumNetworkBytes: dependencies.config.dailyNetworkUploadBytes,
      });
      return json(
        {
          asset: {
            id: asset.id,
            kind: 'image',
            mediaType: asset.contentType,
            width: asset.width,
            height: asset.height,
            byteLength: asset.byteLength,
            sha256: asset.sha256,
          },
          accessibility: {
            alternativeText: asset.alternativeText,
            decorative: asset.decorative,
          },
        },
        { status: 201 },
      );
    }

    if (segments[0] === 'v1' && segments[1] === 'assets' && segments.length === 3) {
      const assetId = segments[2];
      if (!assetId || !SAFE_SLUG.test(assetId)) {
        return apiError(404, 'ASSET_NOT_FOUND', 'This image is unavailable.');
      }
      if (!dependencies.assets) throw new HttpError(503, 'ASSET_STORE_UNAVAILABLE', 'Images are unavailable.');
      const ownerHash = await ownerHashFrom(request, dependencies.config.deviceTokenSigningSecret, now().getTime());
      if (request.method === 'DELETE') {
        const result = await dependencies.assets.deleteOwned(assetId, ownerHash);
        if (result === 'missing') return apiError(404, 'ASSET_NOT_FOUND', 'This image is unavailable.');
        if (result === 'in-use') {
          return apiError(
            409,
            'ASSET_IN_USE',
            'Remove this image from saved and published widgets before deleting it.',
          );
        }
        return new Response(null, { status: 204 });
      }
      if (request.method !== 'GET') {
        return apiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      }
      const asset = await dependencies.assets.get(assetId);
      if (!asset || asset.record.ownerHash !== ownerHash) {
        return apiError(404, 'ASSET_NOT_FOUND', 'This image is unavailable.');
      }
      return imageResponse(asset);
    }

    if (
      segments[0] === 'v1' &&
      segments[1] === 'drafts' &&
      (segments.length === 3 || segments.length === 4)
    ) {
      const draftId = segments[2];
      const action = segments[3] ?? url.searchParams.get('action');
      if (!draftId || !SAFE_ID.test(draftId)) {
        throw new HttpError(404, 'DRAFT_NOT_FOUND', 'This draft is unavailable.');
      }
      const ownerHash = await ownerHashFrom(request, dependencies.config.deviceTokenSigningSecret, now().getTime());

      if (request.method === 'GET' && segments.length === 3) {
        const draft = await dependencies.repository.getDraft(draftId, ownerHash);
        if (!draft) throw new HttpError(404, 'DRAFT_NOT_FOUND', 'This draft is unavailable.');
        return json({ draft: draftResponse(draft) });
      }

      if (request.method === 'DELETE' && segments.length === 3) {
        const draft = await dependencies.repository.getDraft(draftId, ownerHash);
        if (!draft) throw new HttpError(404, 'DRAFT_NOT_FOUND', 'This draft is unavailable.');
        const deleted = await dependencies.repository.deleteDraft(draftId, ownerHash);
        if (!deleted) throw new HttpError(404, 'DRAFT_NOT_FOUND', 'This draft is unavailable.');
        if (dependencies.assets) {
          for (const asset of draft.spec.assets) {
            await dependencies.assets.deleteOwned(asset.id, ownerHash);
          }
        }
        return new Response(null, { status: 204 });
      }

      if (request.method === 'POST' && action === 'publish') {
        const draft = await dependencies.repository.getDraft(draftId, ownerHash);
        if (!draft) throw new HttpError(404, 'DRAFT_NOT_FOUND', 'This draft is unavailable.');
        await validatedOwnedSpec(draft.spec, ownerHash);

        const timestamp = now();
        await consumeSafetyReviewQuota(request, ownerHash, timestamp);
        const moderation = await dependencies.provider.moderate(draft.spec);
        if (!moderation.safe) {
          throw new HttpError(
            422,
            'UNSAFE_CONTENT',
            'This widget needs a safety review before it can be shared with students.',
            { categories: moderation.categories },
          );
        }
        let publication: PublicationRecord | null = null;
        let latestError: unknown;
        for (let attempt = 0; attempt < 3 && !publication; attempt += 1) {
          try {
            publication = await dependencies.repository.publish({
              slug: createSlug(),
              draft,
              now: timestamp.toISOString(),
              expiresAt: addDays(timestamp, dependencies.config.publicationTtlDays),
            });
          } catch (error) {
            latestError = error;
          }
        }
        if (!publication) throw latestError ?? new Error('Could not create a publication slug.');
        return json(
          { publication: publicationResponse(publication, dependencies.config.publicPlayerOrigin) },
          { status: 201 },
        );
      }

      if (request.method === 'POST' && action === 'patch') {
        const body = objectBody<PatchBody>(await readJson<unknown>(request, 16_000));
        const instruction = requiredString(body.instruction, 'Revision instruction', 2_000);
        rejectModerationFindings(inspectText(instruction));
        if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) {
          throw new HttpError(422, 'INVALID_VERSION', 'A valid expectedVersion is required.');
        }

        const draft = await dependencies.repository.getDraft(draftId, ownerHash);
        if (!draft) throw new HttpError(404, 'DRAFT_NOT_FOUND', 'This draft is unavailable.');
        if (draft.version !== body.expectedVersion) {
          throw new HttpError(
            409,
            'DRAFT_VERSION_CONFLICT',
            'This widget changed on another revision. Reload it before trying again.',
          );
        }
        const timestamp = now();
        await consumeGenerationQuota(request, ownerHash, timestamp);

        const spec = await patchWidgetSpec(dependencies.provider, draft.spec, instruction);
        await validatedOwnedSpec(spec, ownerHash);
        const updated = await dependencies.repository.updateDraft({
          id: draft.id,
          ownerHash,
          title: spec.metadata.title,
          schemaVersion: spec.schemaVersion,
          spec,
          expectedVersion: body.expectedVersion,
          instruction,
          now: timestamp.toISOString(),
        });
        if (!updated) {
          throw new HttpError(
            409,
            'DRAFT_VERSION_CONFLICT',
            'This widget changed on another revision. Reload it before trying again.',
          );
        }
        return json({ draft: draftResponse(updated), provider: dependencies.provider.name });
      }

      if (request.method === 'PUT' && segments.length === 3) {
        const body = objectBody<SaveBody>(await readJson<unknown>(request, 300_000));
        if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) {
          throw new HttpError(422, 'INVALID_VERSION', 'A valid expectedVersion is required.');
        }
        const note = optionalString(body.note, 'Revision note', 500) ?? 'Direct edit';
        rejectModerationFindings(inspectText(note));
        const spec = await validatedOwnedSpec(body.spec, ownerHash);
        const updated = await dependencies.repository.updateDraft({
          id: draftId,
          ownerHash,
          title: spec.metadata.title,
          schemaVersion: spec.schemaVersion,
          spec,
          expectedVersion: body.expectedVersion,
          instruction: note,
          now: now().toISOString(),
        });
        if (!updated) {
          throw new HttpError(
            409,
            'DRAFT_VERSION_CONFLICT',
            'This widget changed on another revision. Reload it before trying again.',
          );
        }
        return json({ draft: draftResponse(updated) });
      }
    }

    if (request.method === 'POST' && url.pathname === '/v1/specs/repair') {
      const ownerHash = await ownerHashFrom(request, dependencies.config.deviceTokenSigningSecret, now().getTime());
      const timestamp = now();
      await consumeGenerationQuota(request, ownerHash, timestamp);
      const body = objectBody<RepairBody>(await readJson<unknown>(request));
      rejectModerationFindings(inspectUnknownText(body.candidate));
      const spec = await repairWidgetSpec(dependencies.provider, body.candidate);
      return json({ spec, provider: dependencies.provider.name });
    }

    if (
      request.method === 'POST' &&
      segments[0] === 'v1' &&
      segments[1] === 'publications' &&
      segments[3] === 'reports' &&
      segments.length === 4
    ) {
      const slug = segments[2];
      if (!slug || !SAFE_SLUG.test(slug)) {
        throw new HttpError(404, 'PUBLICATION_NOT_FOUND', 'This widget link is unavailable.');
      }
      const publication = await dependencies.repository.getPublication(slug);
      if (
        !publication ||
        publication.revokedAt ||
        Date.parse(publication.expiresAt) <= now().getTime()
      ) {
        throw new HttpError(404, 'PUBLICATION_NOT_FOUND', 'This widget link is unavailable.');
      }
      const body = objectBody<ReportBody>(await readJson<unknown>(request, 1_000));
      if (!CONTENT_REPORT_REASONS.has(body.reason)) {
        throw new HttpError(422, 'INVALID_REPORT_REASON', 'Choose a valid reason for the report.');
      }
      const created = await dependencies.repository.createContentReport({
        id: crypto.randomUUID(),
        publicationSlug: slug,
        reason: body.reason,
        now: now().toISOString(),
        maximumPerPublication: 100,
      });
      if (!created) {
        throw new HttpError(429, 'REPORT_LIMIT_REACHED', 'This widget has already received enough reports for review.');
      }
      return new Response(null, { status: 204 });
    }

    if (
      segments[0] === 'v1' &&
      segments[1] === 'publications' &&
      segments[3] === 'assets' &&
      segments.length === 5
    ) {
      const slug = segments[2];
      const assetId = segments[4];
      if (
        request.method !== 'GET' ||
        !slug ||
        !SAFE_SLUG.test(slug) ||
        !assetId ||
        !SAFE_SLUG.test(assetId)
      ) {
        return apiError(404, 'ASSET_NOT_FOUND', 'This image is unavailable.');
      }
      if (!dependencies.assets) {
        throw new HttpError(503, 'ASSET_STORE_UNAVAILABLE', 'Images are unavailable.');
      }
      const publication = await dependencies.repository.getPublication(slug);
      if (!publication) {
        return apiError(404, 'PUBLICATION_NOT_FOUND', 'This widget link is unavailable.');
      }
      if (publication.revokedAt) {
        return apiError(410, 'PUBLICATION_REVOKED', 'The teacher has unpublished this widget.');
      }
      if (Date.parse(publication.expiresAt) <= now().getTime()) {
        return apiError(410, 'PUBLICATION_EXPIRED', 'This widget link has expired.');
      }
      const referenced = publication.spec.assets.some(
        (candidate) => candidate.kind === 'image' && candidate.id === assetId,
      );
      if (!referenced) return apiError(404, 'ASSET_NOT_FOUND', 'This image is unavailable.');
      const asset = await dependencies.assets.get(assetId);
      if (!asset || asset.record.ownerHash !== publication.ownerHash) {
        return apiError(404, 'ASSET_NOT_FOUND', 'This image is unavailable.');
      }
      return imageResponse(asset);
    }

    if (segments[0] === 'v1' && segments[1] === 'publications' && segments.length === 3) {
      const slug = segments[2];
      if (!slug || !SAFE_SLUG.test(slug)) {
        throw new HttpError(404, 'PUBLICATION_NOT_FOUND', 'This widget link is unavailable.');
      }

      if (request.method === 'GET') {
        const publication = await dependencies.repository.getPublication(slug);
        if (!publication) {
          return apiError(404, 'PUBLICATION_NOT_FOUND', 'This widget link is unavailable.');
        }
        if (publication.revokedAt) {
          return apiError(410, 'PUBLICATION_REVOKED', 'The teacher has unpublished this widget.');
        }
        if (Date.parse(publication.expiresAt) <= now().getTime()) {
          return apiError(410, 'PUBLICATION_EXPIRED', 'This widget link has expired. Ask the teacher for a new link.');
        }
        return json(
          {
            status: 'available',
            title: publication.title,
            schemaVersion: publication.schemaVersion,
            spec: publication.spec,
            expiresAt: publication.expiresAt,
          },
          { headers: { 'cache-control': 'private, no-store' } },
        );
      }

      const ownerHash = await ownerHashFrom(request, dependencies.config.deviceTokenSigningSecret, now().getTime());
      if (request.method === 'DELETE') {
        const revoked = await dependencies.repository.revokePublication(
          slug,
          ownerHash,
          now().toISOString(),
        );
        if (!revoked) throw new HttpError(404, 'PUBLICATION_NOT_FOUND', 'This publication is unavailable.');
        return new Response(null, { status: 204 });
      }

      if (request.method === 'PATCH') {
        const body = objectBody<ExtendBody>(await readJson<unknown>(request, 2_000));
        const days = body.days ?? dependencies.config.publicationTtlDays;
        if (!Number.isInteger(days) || days < 1 || days > 365) {
          throw new HttpError(422, 'INVALID_EXPIRY', 'Expiry must be between 1 and 365 days.');
        }
        const publication = await dependencies.repository.extendPublication(
          slug,
          ownerHash,
          addDays(now(), days),
        );
        if (!publication) {
          throw new HttpError(404, 'PUBLICATION_NOT_FOUND', 'This publication is unavailable.');
        }
        return json({
          publication: publicationResponse(publication, dependencies.config.publicPlayerOrigin),
        });
      }
    }

    return apiError(404, 'NOT_FOUND', 'Endpoint not found.');
  }

  return {
    async fetch(request: Request): Promise<Response> {
      try {
        return finaliseResponse(await handle(request), request, dependencies.config);
      } catch (error) {
        let response: Response;
        if (error instanceof HttpError) {
          response = apiError(error.status, error.code, error.message, error.details);
        } else if (error instanceof InvalidModelOutputError) {
          response = apiError(
            422,
            'INVALID_MODEL_OUTPUT',
            'The widget could not be generated safely. Try simplifying the request.',
            error.issues,
          );
        } else if (error instanceof ModelProviderError) {
          console.error('Studio model provider error', {
            provider: dependencies.provider.name,
            retryable: error.retryable,
            message: error.message.slice(0, 500),
          });
          response = apiError(
            error.retryable ? 503 : 502,
            'MODEL_PROVIDER_ERROR',
            error.retryable
              ? 'The generator is temporarily unavailable. Try again shortly.'
              : 'The generator could not complete this request.',
          );
        } else {
          console.error('Unhandled Studio API error', error);
          response = apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Try again.');
        }
        return finaliseResponse(response, request, dependencies.config);
      }
    },
  };
}

function finaliseResponse(
  response: Response,
  request: Request,
  config: StudioConfig,
): Response {
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith('/v1/')) {
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'private, no-store');
    headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
    const vary = new Set(
      (headers.get('vary') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    vary.add('X-Device-Token');
    headers.set('vary', [...vary].join(', '));
    response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return withCors(response, request, config);
}
