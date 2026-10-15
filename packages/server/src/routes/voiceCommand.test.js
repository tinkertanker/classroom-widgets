const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const voiceCommandRouter = require('./voiceCommand');
const { stopRateLimiterCleanup } = require('../middleware/socketAuth');

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

  it('matches a known transcript to its command', async () => {
    const res = await postTranscript({ transcript: 'create a timer', context: {}, userPreferences: {} });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.command.action, 'CREATE_TIMER');
    assert.equal(body.command.target, 'timer');
  });

  it('rejects gibberish via the intent prefilter without leaking internal markers', async () => {
    const res = await postTranscript({
      transcript: 'blargle wibble frobnicate quantum zebra',
      context: {},
      userPreferences: {}
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.command.action, 'UNKNOWN');
    assert.ok(!('viaIntentPrefilter' in body), 'viaIntentPrefilter must not leak');
    assert.ok(!('skipAIFallback' in body), 'skipAIFallback must not leak');
  });

  it('resolves both randomise and randomize spellings', async () => {
    for (const transcript of ['randomise', 'randomize']) {
      const res = await postTranscript({ transcript, context: {}, userPreferences: {} });
      const body = await res.json();
      assert.equal(body.success, true, `"${transcript}" should match`);
      assert.equal(body.command.action, 'RANDOMISE', `"${transcript}" should resolve to RANDOMISE`);
    }
  });
});
