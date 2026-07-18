import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { validateWidgetSpec } from '../packages/widget-spec/src/index.js';

const origin = (process.env.STUDIO_LIVE_ORIGIN ??
  'https://classroom-widgets-studio-api.dark-cell-6287.workers.dev').replace(/\/$/, '');
const tokenPath = resolve('.studio-smoke-token');
const pilotCodesPath = resolve('.studio-pilot-codes.txt');
let token = process.env.STUDIO_DEVICE_TOKEN?.trim() ||
  (existsSync(tokenPath) ? readFileSync(tokenPath, 'utf8').trim() : '');
const headers: Record<string, string> = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function ensureDeviceToken(): Promise<void> {
  if (token) {
    headers['X-Device-Token'] = token;
    return;
  }
  const localSmokeCode = existsSync(pilotCodesPath)
    ? /^SMOKE\.\s+([A-Z0-9-]+)$/m.exec(readFileSync(pilotCodesPath, 'utf8'))?.[1]
    : undefined;
  const accessCode = process.env.STUDIO_PILOT_ACCESS_CODE?.trim() || localSmokeCode;
  if (!accessCode) {
    throw new Error(
      'Set STUDIO_PILOT_ACCESS_CODE for the first live verification, or restore .studio-smoke-token.',
    );
  }
  const response = await fetch(`${origin}/v1/devices/register`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode }),
  });
  const body = await response.json().catch(() => undefined) as
    | { token?: string }
    | { error?: { message?: string } }
    | undefined;
  if (!response.ok || !body || !('token' in body) || !body.token) {
    const message = body && 'error' in body ? body.error?.message : undefined;
    throw new Error(`Device registration failed (${response.status}): ${message ?? 'unknown error'}`);
  }
  token = body.token;
  headers['X-Device-Token'] = token;
  writeFileSync(tokenPath, `${token}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
}

async function jsonRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return { response, body };
}

async function main() {
  await ensureDeviceToken();
  let draftId: string | undefined;
  let slug: string | undefined;
  let assetId: string | undefined;
  try {
    const health = await fetch(`${origin}/health`);
    if (!health.ok) throw new Error(`Health check failed with ${health.status}.`);

    const generated = await jsonRequest('/v1/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({
        level: 'Secondary 2',
        subject: 'Science',
        learningObjective: 'Distinguish balanced and unbalanced forces in familiar situations.',
        studentAction: 'Choose an answer and read immediate explanatory feedback.',
        durationMinutes: 6,
      }),
    });
    const draft = Reflect.get(generated.body as object, 'draft') as Record<string, unknown>;
    draftId = String(draft.id);
    if (draft.version !== 1 || !validateWidgetSpec(draft.spec).valid) {
      throw new Error('Live generation returned an invalid first draft.');
    }

    const patched = await jsonRequest(`/v1/drafts/${encodeURIComponent(draftId)}/patch`, {
      method: 'POST',
      body: JSON.stringify({
        instruction: 'Make the student instructions more concise.',
        expectedVersion: 1,
      }),
    });
    const revised = Reflect.get(patched.body as object, 'draft') as Record<string, unknown>;
    if (revised.version !== 2 || !validateWidgetSpec(revised.spec).valid) {
      throw new Error('Live revision did not produce version 2 of a valid widget.');
    }

    const imageBytes = stripPngTextMetadata(
      readFileSync(
        resolve('apps/ipad/Sources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png'),
      ),
    );
    const imageHash = createHash('sha256').update(imageBytes).digest('hex');
    const uploadedImage = await fetch(`${origin}/v1/assets`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'image/png',
        'X-Device-Token': token,
        'X-Image-Width': '1024',
        'X-Image-Height': '1024',
        'X-Image-Sha256': imageHash,
        'X-Image-Alt': 'The Classroom Widgets Studio app icon.',
        'X-Image-Decorative': 'false',
      },
      body: imageBytes,
    });
    const uploadedBody = await uploadedImage.json().catch(() => undefined) as
      | { asset?: Record<string, unknown> }
      | undefined;
    if (!uploadedImage.ok || !uploadedBody?.asset || typeof uploadedBody.asset.id !== 'string') {
      throw new Error(`Live image upload failed (${uploadedImage.status}): ${JSON.stringify(uploadedBody)}`);
    }
    assetId = uploadedBody.asset.id;
    const imageSpec = structuredClone(revised.spec) as Record<string, unknown>;
    const assets = imageSpec.assets as Array<Record<string, unknown>>;
    assets.push(uploadedBody.asset);
    const screens = imageSpec.screens as Array<{ components: Array<Record<string, unknown>> }>;
    screens[0]?.components.push({
      id: 'live-smoke-image',
      kind: 'image',
      assetId,
      altText: 'The Classroom Widgets Studio app icon.',
      decorative: false,
      fit: 'contain',
      caption: 'Image delivery check',
    });
    if (!validateWidgetSpec(imageSpec).valid) {
      throw new Error('The image-enhanced live smoke WidgetSpec is invalid.');
    }
    const saved = await jsonRequest(`/v1/drafts/${encodeURIComponent(draftId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        expectedVersion: 2,
        note: 'Attach a processed, non-personal image for live verification.',
        spec: imageSpec,
      }),
    });
    const imageDraft = Reflect.get(saved.body as object, 'draft') as Record<string, unknown>;
    if (imageDraft.version !== 3 || !validateWidgetSpec(imageDraft.spec).valid) {
      throw new Error('Live image attachment did not produce version 3 of a valid widget.');
    }

    const published = await jsonRequest(`/v1/drafts/${encodeURIComponent(draftId)}/publish`, {
      method: 'POST',
    });
    const publication = Reflect.get(published.body as object, 'publication') as Record<string, unknown>;
    slug = String(publication.slug);
    const publicUrl = String(publication.url);
    if (!publicUrl.startsWith(`${origin}/`)) throw new Error(`Unexpected public URL: ${publicUrl}`);
    const extended = await jsonRequest(`/v1/publications/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: JSON.stringify({ days: 120 }),
    });
    const extendedPublication = Reflect.get(extended.body as object, 'publication') as Record<string, unknown>;
    if (
      extendedPublication.slug !== slug ||
      Date.parse(String(extendedPublication.expiresAt)) <= Date.parse(String(publication.expiresAt))
    ) {
      throw new Error('Publication extension did not preserve the slug and move expiry forward.');
    }

    const publicSpec = await fetch(`${origin}/v1/publications/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
    });
    const publicBody = await publicSpec.json() as { spec?: unknown };
    if (!publicSpec.ok || !validateWidgetSpec(publicBody.spec).valid) {
      throw new Error('Published WidgetSpec could not be loaded anonymously.');
    }
    const player = await fetch(publicUrl, { headers: { Accept: 'text/html' } });
    const html = await player.text();
    if (!player.ok || !html.includes('<title>Classroom Widget</title>')) {
      throw new Error('Published student player did not load.');
    }
    const publicImage = await fetch(
      `${origin}/v1/publications/${encodeURIComponent(slug)}/assets/${encodeURIComponent(assetId)}`,
    );
    const publicImageBytes = Buffer.from(await publicImage.arrayBuffer());
    if (
      !publicImage.ok ||
      publicImage.headers.get('content-type') !== 'image/png' ||
      createHash('sha256').update(publicImageBytes).digest('hex') !== imageHash
    ) {
      throw new Error('Published image could not be loaded intact without credentials.');
    }

    await jsonRequest(`/v1/publications/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    const revoked = await fetch(`${origin}/v1/publications/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
    });
    if (revoked.status !== 410) throw new Error(`Revoked publication returned ${revoked.status}, not 410.`);

    await jsonRequest(`/v1/drafts/${encodeURIComponent(draftId)}`, { method: 'DELETE' });
    draftId = undefined;
    const deletedAsset = await fetch(`${origin}/v1/assets/${encodeURIComponent(assetId)}`, {
      headers: { Accept: 'application/json', 'X-Device-Token': token },
    });
    if (deletedAsset.status !== 404) {
      throw new Error(`Deleted draft's image returned ${deletedAsset.status}, not 404.`);
    }

    console.log('Live Studio flow passed: generate, revise, upload image, publish, extend, public player/image, revoke, delete.');
  } finally {
    if (draftId) {
      const cleanup = await fetch(`${origin}/v1/drafts/${encodeURIComponent(draftId)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', 'X-Device-Token': token },
      });
      if (!cleanup.ok && cleanup.status !== 404) {
        throw new Error(`DELETE /v1/drafts/${encodeURIComponent(draftId)} failed (${cleanup.status}).`);
      }
    }
  }
}

function stripPngTextMetadata(bytes: Buffer): Buffer {
  const blocked = new Set(['eXIf', 'iTXt', 'tEXt', 'zTXt']);
  const chunks = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const next = offset + 12 + length;
    if (next > bytes.length) throw new Error('The Studio icon is not a valid PNG.');
    if (!blocked.has(type)) chunks.push(bytes.subarray(offset, next));
    offset = next;
    if (type === 'IEND') break;
  }
  return Buffer.concat(chunks);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
