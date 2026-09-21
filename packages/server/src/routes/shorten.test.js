const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const createShortenRouter = require('./shorten');
const { stopRateLimiterCleanup } = require('../middleware/rateLimit');

const realFetch = globalThis.fetch;

async function withServer(t, callback) {
  const app = express();
  app.use(express.json());
  app.use('/api/shorten', createShortenRouter());
  t.after(() => stopRateLimiterCleanup());
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address();
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function restoreEnv(t) {
  const previous = {
    apiKey: process.env.SHORTIO_API_KEY,
    domain: process.env.SHORTIO_DOMAIN,
    baseUrl: process.env.SHORTIO_BASE_URL
  };
  delete process.env.SHORTIO_API_KEY;
  delete process.env.SHORTIO_DOMAIN;
  delete process.env.SHORTIO_BASE_URL;
  t.after(() => {
    for (const [name, value] of Object.entries({
      SHORTIO_API_KEY: previous.apiKey,
      SHORTIO_DOMAIN: previous.domain,
      SHORTIO_BASE_URL: previous.baseUrl
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

function stubUpstream(t, handler) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('http://127.0.0.1:')) {
      return realFetch(input, init);
    }
    return handler(input, init);
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
  });
}

test('returns not configured before validation or upstream requests', async (t) => {
  restoreEnv(t);
  delete process.env.SHORTIO_API_KEY;
  delete process.env.SHORTIO_DOMAIN;
  const upstream = () => {
    throw new Error('upstream should not be called');
  };
  stubUpstream(t, upstream);

  await withServer(t, async (baseUrl) => {
    const response = await realFetch(`${baseUrl}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not a url' })
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false,
      code: 'NOT_CONFIGURED',
      error: 'Link shortening is not configured on this server.'
    });
  });
});

test('rejects invalid URLs without calling upstream', async (t) => {
  restoreEnv(t);
  process.env.SHORTIO_API_KEY = 'test-key';
  process.env.SHORTIO_DOMAIN = 'go.example.edu';
  let upstreamCalled = false;
  stubUpstream(t, () => {
    upstreamCalled = true;
    throw new Error('upstream should not be called');
  });

  await withServer(t, async (baseUrl) => {
    const response = await realFetch(`${baseUrl}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not a url' })
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).success, false);
    assert.equal(upstreamCalled, false);
  });
});

test('invalid payloads do not consume the rate limit', async (t) => {
  restoreEnv(t);
  process.env.SHORTIO_API_KEY = 'test-key';
  process.env.SHORTIO_DOMAIN = 'go.example.edu';
  let upstreamCalled = 0;
  stubUpstream(t, async () => {
    upstreamCalled += 1;
    return {
      ok: true,
      status: 201,
      async json() {
        return { secureShortURL: 'https://go.example.edu/abc' };
      }
    };
  });

  await withServer(t, async (baseUrl) => {
    for (let index = 0; index < 31; index += 1) {
      const response = await realFetch(`${baseUrl}/api/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not a url' })
      });
      assert.equal(response.status, 400);
    }

    const validResponse = await realFetch(`${baseUrl}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    assert.equal(validResponse.status, 200);
  });

  assert.equal(upstreamCalled, 1);
});

test('forwards configured requests and returns the secure short URL', async (t) => {
  restoreEnv(t);
  process.env.SHORTIO_API_KEY = 'test-key';
  process.env.SHORTIO_DOMAIN = 'go.example.edu';
  let upstreamRequest;
  stubUpstream(t, async (input, init) => {
    upstreamRequest = { input, init };
    return {
      ok: true,
      status: 201,
      async json() {
        return { secureShortURL: 'https://go.example.edu/abc' };
      }
    };
  });

  await withServer(t, async (baseUrl) => {
    const response = await realFetch(`${baseUrl}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'example.com/path' })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      shortUrl: 'https://go.example.edu/abc'
    });
  });

  assert.equal(upstreamRequest.input, 'https://api.short.io/links/public');
  assert.equal(upstreamRequest.init.headers.authorization, 'test-key');
  assert.deepEqual(JSON.parse(upstreamRequest.init.body), {
    originalURL: 'https://example.com/path',
    domain: 'go.example.edu'
  });
});

test('maps upstream conflicts to a safe client error', async (t) => {
  restoreEnv(t);
  process.env.SHORTIO_API_KEY = 'test-key';
  process.env.SHORTIO_DOMAIN = 'go.example.edu';
  stubUpstream(t, async () => ({
    ok: false,
    status: 409,
    async json() {
      return { error: 'conflict details' };
    }
  }));

  await withServer(t, async (baseUrl) => {
    const response = await realFetch(`${baseUrl}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      success: false,
      error: 'That custom ending is already taken. Try another.'
    });
  });
});

test('does not expose upstream error details', async (t) => {
  restoreEnv(t);
  process.env.SHORTIO_API_KEY = 'test-key';
  process.env.SHORTIO_DOMAIN = 'go.example.edu';
  stubUpstream(t, async () => ({
    ok: false,
    status: 500,
    async json() {
      return { error: 'secret-upstream-detail' };
    }
  }));

  await withServer(t, async (baseUrl) => {
    const response = await realFetch(`${baseUrl}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    assert.equal(response.status, 502);
    assert.equal((await response.text()).includes('secret-upstream-detail'), false);
  });
});

test('status reflects whether Short.io is configured', async (t) => {
  restoreEnv(t);
  delete process.env.SHORTIO_API_KEY;
  delete process.env.SHORTIO_DOMAIN;
  await withServer(t, async (baseUrl) => {
    let response = await realFetch(`${baseUrl}/api/shorten/status`);
    assert.deepEqual(await response.json(), { success: true, configured: false });

    process.env.SHORTIO_API_KEY = 'test-key';
    process.env.SHORTIO_DOMAIN = 'go.example.edu';
    response = await realFetch(`${baseUrl}/api/shorten/status`);
    assert.deepEqual(await response.json(), { success: true, configured: true });
  });
});
