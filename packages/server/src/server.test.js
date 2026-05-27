const test = require('node:test');
const assert = require('node:assert/strict');
const AppServer = require('./server');

test('CORS origin matching requires exact parsed origins', () => {
  assert.equal(AppServer.isOriginAllowed('http://localhost:3000'), true);
  assert.equal(AppServer.isOriginAllowed('http://localhost:3000.evil.example'), false);
});

test('CORS origin matching allows development localhost ports only by hostname', () => {
  assert.equal(AppServer.isOriginAllowed('http://127.0.0.1:5173'), true);
  assert.equal(AppServer.isOriginAllowed('http://127.0.0.1.evil.example:5173'), false);
});

test('CORS origin matching allows non-browser requests and rejects malformed origins', () => {
  assert.equal(AppServer.isOriginAllowed(undefined), true);
  assert.equal(AppServer.isOriginAllowed('not a url'), false);
});

test('voice command requests keep the larger JSON body limit', async () => {
  const server = new AppServer();
  server.configureMiddleware();
  server.app.post('/api/voice-command/test', (req, res) => {
    res.json({ length: req.body.transcript.length });
  });
  server.app.post('/api/other-test', (req, res) => {
    res.json({ length: req.body.transcript.length });
  });
  server.app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.type || 'error' });
  });

  await new Promise((resolve) => server.server.listen(0, resolve));

  try {
    const { port } = server.server.address();
    const url = `http://127.0.0.1:${port}`;
    const body = JSON.stringify({ transcript: 'x'.repeat(300 * 1024) });
    const headers = { 'content-type': 'application/json' };

    const voiceResponse = await fetch(`${url}/api/voice-command/test`, { method: 'POST', headers, body });
    assert.equal(voiceResponse.status, 200);

    const otherResponse = await fetch(`${url}/api/other-test`, { method: 'POST', headers, body });
    assert.equal(otherResponse.status, 413);
  } finally {
    await new Promise((resolve) => server.server.close(resolve));
    server.sessionManager.stopCleanupInterval();
  }
});
