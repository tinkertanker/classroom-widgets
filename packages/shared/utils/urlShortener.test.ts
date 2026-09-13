import { describe, expect, test, vi } from 'vitest';
import {
  buildShortenRequest,
  createDefaultShortenerSettings,
  normaliseTargetUrl,
  parseShortenResponse,
  shortenUrl,
  validateAlias,
  validateShortenerSettings,
  validateTargetUrl,
  type ShortenerSettings
} from './urlShortener';

const tinyurl: ShortenerSettings = createDefaultShortenerSettings();
const spoo: ShortenerSettings = { ...tinyurl, provider: 'spoo' };
const shortio: ShortenerSettings = {
  provider: 'shortio',
  shortioApiKey: 'pk_test',
  shortioDomain: 'go.example.edu'
};

describe('normaliseTargetUrl', () => {
  test('adds https to a bare host', () => {
    expect(normaliseTargetUrl(' example.com/path ')).toBe('https://example.com/path');
  });

  test('leaves an existing scheme alone', () => {
    expect(normaliseTargetUrl('http://example.com')).toBe('http://example.com');
  });
});

describe('validateTargetUrl', () => {
  test.each([
    ['', 'Enter a link to shorten.'],
    ['not a url', 'That does not look like a valid link.'],
    ['localhost', 'That does not look like a valid link.'],
    ['javascript:alert(1)', 'Only http and https links can be shortened.']
  ])('rejects %j', (input, message) => {
    expect(validateTargetUrl(input)).toBe(message);
  });

  test('accepts a plain host', () => {
    expect(validateTargetUrl('example.com')).toBeNull();
  });
});

describe('validateAlias', () => {
  test('allows an empty alias', () => {
    expect(validateAlias(undefined)).toBeNull();
    expect(validateAlias('')).toBeNull();
  });

  test('allows letters, digits, hyphens and underscores', () => {
    expect(validateAlias('p5-quiz_2')).toBeNull();
  });

  test.each(['ab', 'has space', 'has/slash'])('rejects %j', (alias) => {
    expect(validateAlias(alias)).not.toBeNull();
  });
});

describe('validateShortenerSettings', () => {
  test('free providers need no setup', () => {
    expect(validateShortenerSettings(tinyurl)).toBeNull();
    expect(validateShortenerSettings(spoo)).toBeNull();
  });

  test('Short.io needs both a key and a domain', () => {
    expect(validateShortenerSettings({ ...shortio, shortioApiKey: ' ' })).toMatch(/API key/);
    expect(validateShortenerSettings({ ...shortio, shortioDomain: '' })).toMatch(/domain/);
    expect(validateShortenerSettings(shortio)).toBeNull();
  });
});

describe('buildShortenRequest', () => {
  test('TinyURL uses a GET with the target encoded in the query', () => {
    const request = buildShortenRequest({ url: 'example.com/a b', settings: tinyurl });
    expect(request.init.method).toBe('GET');
    expect(request.url).toBe(
      'https://tinyurl.com/api-create.php?url=https%3A%2F%2Fexample.com%2Fa+b'
    );
  });

  test('TinyURL passes a custom ending as `alias`', () => {
    const request = buildShortenRequest({ url: 'example.com', settings: tinyurl, alias: 'p5-quiz' });
    expect(request.url).toContain('alias=p5-quiz');
  });

  test('spoo.me posts a form body and asks for JSON', () => {
    const request = buildShortenRequest({ url: 'example.com', settings: spoo, alias: 'p5quiz' });
    expect(request.url).toBe('https://spoo.me/');
    expect(request.init.method).toBe('POST');
    expect(request.init.headers?.Accept).toBe('application/json');
    expect(request.init.body).toBe('url=https%3A%2F%2Fexample.com&alias=p5quiz');
  });

  test('Short.io sends the public key and the branded domain', () => {
    const request = buildShortenRequest({
      url: 'example.com',
      settings: shortio,
      alias: 'p5quiz',
      title: 'Lesson 5'
    });
    expect(request.url).toBe('https://api.short.io/links/public');
    expect(request.init.headers?.authorization).toBe('pk_test');
    expect(JSON.parse(request.init.body!)).toEqual({
      originalURL: 'https://example.com',
      domain: 'go.example.edu',
      path: 'p5quiz',
      title: 'Lesson 5'
    });
  });

  test('omits the alias entirely when none is given', () => {
    expect(buildShortenRequest({ url: 'example.com', settings: tinyurl }).url).not.toContain('alias');
    expect(buildShortenRequest({ url: 'example.com', settings: spoo }).init.body).not.toContain('alias');
    expect(JSON.parse(buildShortenRequest({ url: 'example.com', settings: shortio }).init.body!))
      .not.toHaveProperty('path');
  });
});

// Bodies below are the literal responses observed from each live API, except the
// Short.io error shapes, which come from its published reference.
describe('parseShortenResponse', () => {
  test('TinyURL success', () => {
    expect(parseShortenResponse('tinyurl', 200, 'https://tinyurl.com/y58t7o6l\n')).toEqual({
      ok: true,
      shortUrl: 'https://tinyurl.com/y58t7o6l'
    });
  });

  test('TinyURL failure is the bare word Error', () => {
    expect(parseShortenResponse('tinyurl', 200, 'Error')).toEqual({
      ok: false,
      message: 'Could not shorten that link. Please try again.'
    });
  });

  test('TinyURL cannot distinguish a taken alias, so a failed aliased request reads as a clash', () => {
    // Verified live: `?alias=google` returns the same bare `Error` as any other failure.
    expect(parseShortenResponse('tinyurl', 200, 'Error', { aliasRequested: true })).toEqual({
      ok: false,
      message: 'That custom ending is already taken. Try another.'
    });
  });

  test('spoo.me success is upgraded to https', () => {
    const body = '{"short_url":"http://spoo.me/vp7v4B","domain":"spoo.me","original_url":"https://example.com/foo"}';
    expect(parseShortenResponse('spoo', 200, body)).toEqual({
      ok: true,
      shortUrl: 'https://spoo.me/vp7v4B'
    });
  });

  test('spoo.me alias clash', () => {
    const body = '{"AliasError":"Alias already exists","alias":"google"}';
    expect(parseShortenResponse('spoo', 400, body)).toEqual({
      ok: false,
      message: 'That custom ending is already taken. Try another.'
    });
  });

  test('spoo.me invalid URL', () => {
    const body = '{"UrlError":"Invalid URL, URL must have a valid protocol"}';
    expect(parseShortenResponse('spoo', 400, body)).toEqual({
      ok: false,
      message: 'That link was rejected as invalid.'
    });
  });

  test('spoo.me rate limit', () => {
    expect(parseShortenResponse('spoo', 429, '{}')).toEqual({
      ok: false,
      message: 'Too many links just now. Wait a moment and try again.'
    });
  });

  test('Short.io prefers the secure short URL', () => {
    const body = JSON.stringify({
      shortURL: 'http://go.example.edu/abc',
      secureShortURL: 'https://go.example.edu/abc'
    });
    expect(parseShortenResponse('shortio', 200, body)).toEqual({
      ok: true,
      shortUrl: 'https://go.example.edu/abc'
    });
  });

  test('Short.io falls back to shortURL when there is no secure variant', () => {
    const body = JSON.stringify({ shortURL: 'http://go.example.edu/abc' });
    expect(parseShortenResponse('shortio', 200, body)).toEqual({
      ok: true,
      shortUrl: 'https://go.example.edu/abc'
    });
  });

  test('Short.io surfaces its own error message', () => {
    const body = JSON.stringify({ statusCode: 400, code: 'BadRequest', message: 'domain not found' });
    expect(parseShortenResponse('shortio', 400, body)).toEqual({
      ok: false,
      message: 'Short.io: domain not found'
    });
  });

  test('Short.io rejects a bad key', () => {
    expect(parseShortenResponse('shortio', 401, '{}')).toEqual({
      ok: false,
      message: 'Short.io rejected that API key. Check it in Settings.'
    });
  });

  test('an HTML error page does not read as success', () => {
    expect(parseShortenResponse('spoo', 502, '<html>Bad Gateway</html>')).toEqual({
      ok: false,
      message: 'Could not shorten that link. Please try again.'
    });
  });
});

describe('shortenUrl', () => {
  const okResponse = (body: string, status = 200) =>
    ({ status, text: async () => body }) as unknown as Response;

  test.each(['headers', 'body'])('times out stalled %s without aborting the caller', async (stage) => {
    vi.useFakeTimers();
    try {
      const caller = new AbortController();
      const fetchMock = vi.fn((_url, init) => {
        const pending = new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
        return stage === 'headers' ? pending : Promise.resolve({ status: 200, text: () => pending });
      });
      const result = shortenUrl({ url: 'example.com', settings: tinyurl }, { fetch: fetchMock as typeof fetch, signal: caller.signal });
      await vi.advanceTimersByTimeAsync(15000);
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
      expect(caller.signal.aborted).toBe(false);
      expect(await result).toEqual({ ok: false, message: 'Shortening took too long. Please try again.' });
    } finally {
      vi.useRealTimers();
    }
  });

  test('returns the short link on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('https://tinyurl.com/abcd'));
    const result = await shortenUrl({ url: 'example.com', settings: tinyurl }, { fetch: fetchMock });
    expect(result).toEqual({ ok: true, shortUrl: 'https://tinyurl.com/abcd' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('validates before reaching the network', async () => {
    const fetchMock = vi.fn();
    const result = await shortenUrl({ url: 'not a url', settings: tinyurl }, { fetch: fetchMock });
    expect(result).toEqual({ ok: false, message: 'That does not look like a valid link.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('an unconfigured Short.io never calls out', async () => {
    const fetchMock = vi.fn();
    const result = await shortenUrl(
      { url: 'example.com', settings: { ...shortio, shortioApiKey: '' } },
      { fetch: fetchMock }
    );
    expect(result).toEqual({ ok: false, message: 'Add your Short.io public API key in Settings.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a network failure names the provider and points at Settings', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await shortenUrl({ url: 'example.com', settings: spoo }, { fetch: fetchMock });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('spoo.me');
  });
});
