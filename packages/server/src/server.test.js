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
