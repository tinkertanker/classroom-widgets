/**
 * URL shortening providers.
 *
 * Functional core: `buildShortenRequest` and `parseShortenResponse` are pure and
 * carry every provider quirk. `shortenUrl` is the thin imperative shell that
 * performs the fetch.
 *
 * All three providers are callable directly from the browser (verified CORS):
 *  - TinyURL reflects the request Origin, so it also works from the macOS
 *    dashboard's `classroom-widgets://` scheme and from `file://` (Origin: null).
 *  - spoo.me sends `Access-Control-Allow-Origin: *` and answers preflights.
 *  - Short.io's `/links/public` endpoint is documented for client-side use with
 *    a *public* API key.
 *
 * is.gd/v.gd were evaluated and rejected: their CORS headers are inconsistent
 * and their own docs steer cross-origin callers to JSONP.
 */

export type ShortenerProvider = 'tinyurl' | 'spoo' | 'shortio';

export interface ShortenerSettings {
  provider: ShortenerProvider;
  /** Short.io *public* API key (pk_...). Only used by the `shortio` provider. */
  shortioApiKey: string;
  /** Short.io branded domain, e.g. `go.myschool.edu`. Required by Short.io. */
  shortioDomain: string;
}

export interface ShortenerProviderInfo {
  id: ShortenerProvider;
  label: string;
  /** Host shown in the picker so teachers can check it against their filter. */
  domain: string;
  description: string;
  requiresApiKey: boolean;
  supportsAlias: boolean;
}

export const SHORTENER_PROVIDERS: readonly ShortenerProviderInfo[] = [
  {
    id: 'tinyurl',
    label: 'TinyURL',
    domain: 'tinyurl.com',
    description: 'Free, no sign-up. Custom endings supported.',
    requiresApiKey: false,
    supportsAlias: true
  },
  {
    id: 'spoo',
    label: 'spoo.me',
    domain: 'spoo.me',
    description: 'Free, no sign-up. Open source, shorter links.',
    requiresApiKey: false,
    supportsAlias: true
  },
  {
    id: 'shortio',
    label: 'Short.io',
    domain: 'your own domain',
    description: 'Your own branded domain. Needs a public API key.',
    requiresApiKey: true,
    supportsAlias: true
  }
] as const;

export const DEFAULT_SHORTENER_PROVIDER: ShortenerProvider = 'tinyurl';

export function createDefaultShortenerSettings(): ShortenerSettings {
  return { provider: DEFAULT_SHORTENER_PROVIDER, shortioApiKey: '', shortioDomain: '' };
}

export function getProviderInfo(provider: ShortenerProvider): ShortenerProviderInfo {
  return SHORTENER_PROVIDERS.find((p) => p.id === provider) ?? SHORTENER_PROVIDERS[0];
}

export interface ShortenInput {
  url: string;
  settings: ShortenerSettings;
  /** Optional custom ending, e.g. `p5-quiz`. */
  alias?: string;
  /** Short.io only: human-readable label stored against the link. */
  title?: string;
}

export interface ShortenRequest {
  url: string;
  init: {
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
  };
}

export type ShortenResult =
  | { ok: true; shortUrl: string }
  | { ok: false; message: string };

const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;

const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):(\/\/)?/i;

/**
 * The scheme a teacher typed, or null when they typed a bare host. `example.com:8080/x`
 * is a host and port, not a scheme, so it reads as bare.
 */
function detectScheme(trimmed: string): string | null {
  const match = SCHEME_PATTERN.exec(trimmed);
  if (!match) return null;
  if (match[2]) return match[1].toLowerCase();
  if (match[1].includes('.') && /^\d/.test(trimmed.slice(match[0].length))) return null;
  return match[1].toLowerCase();
}

/**
 * Accept what a teacher would actually type. Bare hosts get an https:// prefix
 * rather than an error.
 */
export function normaliseTargetUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return detectScheme(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Returns an error message when the URL cannot be shortened, else null. */
export function validateTargetUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return 'Enter a link to shorten.';

  const scheme = detectScheme(trimmed);
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    return 'Only http and https links can be shortened.';
  }

  let parsed: URL;
  try {
    parsed = new URL(normaliseTargetUrl(trimmed));
  } catch {
    return 'That does not look like a valid link.';
  }
  if (!parsed.hostname.includes('.')) {
    return 'That does not look like a valid link.';
  }
  return null;
}

/** Returns an error message when the alias is unusable, else null. */
export function validateAlias(alias: string | undefined): string | null {
  if (!alias) return null;
  return ALIAS_PATTERN.test(alias)
    ? null
    : 'Custom endings use 3-40 letters, numbers, hyphens or underscores.';
}

/**
 * Returns an error message when the chosen provider is not usable yet, else
 * null. Callers use this to show a "finish setup" state instead of an error.
 */
export function validateShortenerSettings(settings: ShortenerSettings): string | null {
  if (settings.provider !== 'shortio') return null;
  if (!settings.shortioApiKey.trim()) return 'Add your Short.io public API key in Settings.';
  if (!settings.shortioDomain.trim()) return 'Add your Short.io domain in Settings.';
  return null;
}

export function buildShortenRequest({ url, settings, alias, title }: ShortenInput): ShortenRequest {
  const target = normaliseTargetUrl(url);

  switch (settings.provider) {
    case 'spoo': {
      const body = new URLSearchParams({ url: target });
      if (alias) body.set('alias', alias);
      return {
        url: 'https://spoo.me/',
        init: {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        }
      };
    }

    case 'shortio': {
      const payload: Record<string, string> = {
        originalURL: target,
        domain: settings.shortioDomain.trim()
      };
      if (alias) payload.path = alias;
      if (title) payload.title = title;
      return {
        url: 'https://api.short.io/links/public',
        init: {
          method: 'POST',
          headers: {
            authorization: settings.shortioApiKey.trim(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      };
    }

    case 'tinyurl':
    default: {
      const query = new URLSearchParams({ url: target });
      if (alias) query.set('alias', alias);
      return {
        url: `https://tinyurl.com/api-create.php?${query.toString()}`,
        init: { method: 'GET' }
      };
    }
  }
}

function parseJsonBody(body: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** spoo.me hands back `http://spoo.me/...`; the https link works and scans the same. */
function preferHttps(shortUrl: string): string {
  return shortUrl.replace(/^http:\/\//i, 'https://');
}

const GENERIC_FAILURE = 'Could not shorten that link. Please try again.';
const ALIAS_TAKEN = 'That custom ending is already taken. Try another.';

export interface ParseContext {
  /** Whether the request asked for a custom ending, which changes what a failure means. */
  aliasRequested?: boolean;
}

export function parseShortenResponse(
  provider: ShortenerProvider,
  status: number,
  rawBody: string,
  context: ParseContext = {}
): ShortenResult {
  const body = rawBody.trim();

  if (provider === 'tinyurl') {
    // TinyURL always answers 200 with plain text: either the link, or the bare
    // word `Error` for every failure — a taken alias is indistinguishable from
    // anything else. Since the URL is validated before we call out, a failure
    // on a request that carried an alias is almost always a collision.
    if (status === 200 && /^https?:\/\//i.test(body)) {
      return { ok: true, shortUrl: preferHttps(body) };
    }
    return { ok: false, message: context.aliasRequested ? ALIAS_TAKEN : GENERIC_FAILURE };
  }

  const json = parseJsonBody(body);

  if (provider === 'spoo') {
    const shortUrl = json?.short_url;
    if (status < 400 && typeof shortUrl === 'string' && shortUrl) {
      return { ok: true, shortUrl: preferHttps(shortUrl) };
    }
    if (typeof json?.AliasError === 'string') {
      return { ok: false, message: ALIAS_TAKEN };
    }
    if (typeof json?.UrlError === 'string') {
      return { ok: false, message: 'That link was rejected as invalid.' };
    }
    if (status === 429) {
      return { ok: false, message: 'Too many links just now. Wait a moment and try again.' };
    }
    return { ok: false, message: GENERIC_FAILURE };
  }

  // Short.io
  const shortUrl = json?.secureShortURL ?? json?.shortURL;
  if (status < 400 && typeof shortUrl === 'string' && shortUrl) {
    return { ok: true, shortUrl };
  }
  if (status === 401 || status === 403) {
    return { ok: false, message: 'Short.io rejected that API key. Check it in Settings.' };
  }
  if (typeof json?.message === 'string' && json.message) {
    return { ok: false, message: `Short.io: ${json.message}` };
  }
  return { ok: false, message: GENERIC_FAILURE };
}

export interface ShortenDeps {
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

/** Imperative shell: validate, fetch, hand the raw response back to the core. */
export async function shortenUrl(
  input: ShortenInput,
  deps: ShortenDeps = {}
): Promise<ShortenResult> {
  const settingsError = validateShortenerSettings(input.settings);
  if (settingsError) return { ok: false, message: settingsError };

  const urlError = validateTargetUrl(input.url);
  if (urlError) return { ok: false, message: urlError };

  const aliasError = validateAlias(input.alias);
  if (aliasError) return { ok: false, message: aliasError };

  const request = buildShortenRequest(input);
  const doFetch = deps.fetch ?? globalThis.fetch;

  const controller = new AbortController();
  const abort = () => controller.abort();
  deps.signal?.addEventListener('abort', abort, { once: true });
  if (deps.signal?.aborted) abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);

  try {
    const response = await doFetch(request.url, { ...request.init, signal: controller.signal });
    const body = await response.text();
    return parseShortenResponse(input.settings.provider, response.status, body, {
      aliasRequested: Boolean(input.alias)
    });
  } catch {
    return {
      ok: false,
      message: timedOut
        ? 'Shortening took too long. Please try again.'
        : `Could not reach ${getProviderInfo(input.settings.provider).domain}. Check the connection, or try another shortener in Settings.`
    };
  } finally {
    clearTimeout(timeout);
    deps.signal?.removeEventListener('abort', abort);
  }
}
