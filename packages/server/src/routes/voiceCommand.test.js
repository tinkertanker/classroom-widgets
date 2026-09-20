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

  it('processes a normal command', async () => {
    const res = await postTranscript({ transcript: 'create a timer' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.command.action, 'CREATE_TIMER');
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

describe('createIpRateLimiter', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(createIpRateLimiter({ windowMs: 60_000, max: 3 }));
    app.get('/ping', (req, res) => res.json({ ok: true }));
    server = await startServer(app);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    stopRateLimiterCleanup();
  });

  it('allows up to max requests then returns 429 with Retry-After', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/ping`);
      assert.equal(res.status, 200, `request ${i + 1}`);
    }
    const res = await fetch(`${baseUrl}/ping`);
    assert.equal(res.status, 429);
    assert.ok(res.headers.get('retry-after'), 'expected Retry-After header');
    const body = await res.json();
    assert.match(body.error, /too many/i);
  });
});
