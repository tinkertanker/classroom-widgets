import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateWidgetSpec } from '../packages/widget-spec/src/index.js';

const origin = (process.env.STUDIO_LIVE_ORIGIN ??
  'https://classroom-widgets-studio-api.dark-cell-6287.workers.dev').replace(/\/$/, '');
const root = resolve(process.env.INIT_CWD ?? process.cwd());
const statePath = resolve(tmpdir(), 'classroom-widgets-studio-browser-fixture.json');
const action = process.argv[2];

interface FixtureState {
  draftId: string;
  slug: string;
  url: string;
}

async function authenticated(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await readFile(resolve(root, '.studio-smoke-token'), 'utf8')).trim();
  return fetch(`${origin}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Device-Token': token,
      ...init.headers,
    },
  });
}

async function expectJson(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await authenticated(path, init);
  const body = await response.json().catch(() => undefined);
  if (!response.ok || body === undefined || body === null || typeof body !== 'object') {
    throw new Error(`${init.method ?? 'GET'} ${path} failed with ${response.status}.`);
  }
  return body as Record<string, unknown>;
}

async function expectSuccess(path: string, init: RequestInit): Promise<void> {
  const response = await authenticated(path, init);
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed with ${response.status}.`);
  }
}

async function prepare(): Promise<void> {
  const candidate = JSON.parse(
    await readFile(resolve(root, 'examples/studio/classroom-routines-toolkit.widget.json'), 'utf8'),
  ) as unknown;
  const validation = validateWidgetSpec(candidate);
  if (!validation.valid) throw new Error('The ready-tools browser fixture is invalid.');

  const imported = await expectJson('/v1/drafts', {
    method: 'POST',
    body: JSON.stringify({ spec: validation.value }),
  });
  const draft = imported.draft as { id?: unknown; version?: unknown } | undefined;
  if (typeof draft?.id !== 'string' || !Number.isInteger(draft.version)) {
    throw new Error('Studio did not return a versioned draft.');
  }

  try {
    const published = await expectJson(`/v1/drafts/${encodeURIComponent(draft.id)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: draft.version }),
    });
    const publication = published.publication as { slug?: unknown; url?: unknown } | undefined;
    if (typeof publication?.slug !== 'string' || typeof publication.url !== 'string') {
      throw new Error('Studio did not return a publication URL.');
    }
    const state: FixtureState = {
      draftId: draft.id,
      slug: publication.slug,
      url: publication.url,
    };
    await writeFile(statePath, `${JSON.stringify(state)}\n`, { encoding: 'utf8', mode: 0o600 });
    console.log(state.url);
  } catch (error) {
    await expectSuccess(`/v1/drafts/${encodeURIComponent(draft.id)}`, { method: 'DELETE' });
    throw error;
  }
}

async function cleanup(): Promise<void> {
  const state = JSON.parse(await readFile(statePath, 'utf8')) as FixtureState;
  await expectSuccess(`/v1/publications/${encodeURIComponent(state.slug)}`, { method: 'DELETE' });
  await expectSuccess(`/v1/drafts/${encodeURIComponent(state.draftId)}`, { method: 'DELETE' });
  await writeFile(statePath, `${JSON.stringify({ cleanedAt: new Date().toISOString() })}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  console.log('Browser fixture revoked and deleted.');
}

async function main(): Promise<void> {
  if (action === 'prepare') await prepare();
  else if (action === 'cleanup') await cleanup();
  else throw new Error('Usage: tsx scripts/studio-browser-fixture.ts prepare|cleanup');
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
