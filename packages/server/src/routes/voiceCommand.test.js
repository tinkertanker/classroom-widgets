const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const voiceCommandRouter = require('./voiceCommand');
const { createIpRateLimiter, stopRateLimiterCleanup } = require('../middleware/socketAuth');

const startServer = (app) => new Promise((resolve) => {
  const server = app.listen(0, () => resolve(server));
});

const buildVoiceApp = () => {
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/voice-command', voiceCommandRouter);
  return app;
};

describe('POST /api/voice-command hardening', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await startServer(buildVoiceApp());
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    stopRateLimiterCleanup();
  });

  const postTranscript = (body) => fetch(`${baseUrl}/api/voice-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  it('rejects transcripts over MAX_TRANSCRIPT_LENGTH quickly', async () => {
    const transcript = 'create banner ' + 'a'.repeat(5000);
    const start = Date.now();
    const res = await postTranscript({ transcript });
    const elapsed = Date.now() - start;
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /too long/i);
    assert.ok(elapsed < 500, `took ${elapsed}ms`);
  });

  it('handles a transcript exactly at the cap without blowup', async () => {
    const transcript = ('create banner ' + 'a'.repeat(1000)).slice(0, 1000);
    assert.equal(transcript.length, 1000);
    const start = Date.now();
    const res = await postTranscript({ transcript });
    const elapsed = Date.now() - start;
    assert.equal(res.status, 200);
    assert.ok(elapsed < 500, `took ${elapsed}ms`);
  });

  it('rejects bodies over 64kb', async () => {
    const res = await postTranscript({
      transcript: 'create a timer',
      context: { blob: 'x'.repeat(100 * 1024) }
    });
    assert.equal(res.status, 413);
  });
});

describe('voice-command per-client rate limiting', () => {
  let server;
  let baseUrl;

  const postTranscript = (ip) => fetch(`${baseUrl}/api/voice-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ transcript: 'create a timer' })
  });

  before(async () => {
    // Mirror production: trust private proxy hops so X-Forwarded-For from
    // loopback/linklocal resolves req.ip to the real client.
    const app = express();
    app.set('trust proxy', 'loopback, linklocal, uniquelocal');
    app.use(express.json({ limit: '64kb' }));
    const limitedRouter = express.Router();
    limitedRouter.post('/', createIpRateLimiter({ windowMs: 60_000, max: 2 }), (req, res) => {
      res.json({ ok: true });
    });
    limitedRouter.get('/health', (req, res) => res.json({ status: 'healthy' }));
    app.use('/api/voice-command', limitedRouter);
    server = await startServer(app);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    stopRateLimiterCleanup();
  });

  it('limits each forwarded client IP independently', async () => {
    assert.equal((await postTranscript('203.0.113.5')).status, 200);
    assert.equal((await postTranscript('203.0.113.5')).status, 200);
    assert.equal((await postTranscript('203.0.113.6')).status, 200);
    const limited = await postTranscript('203.0.113.5');
    assert.equal(limited.status, 429);
  });
});
