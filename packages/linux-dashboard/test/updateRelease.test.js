const test = require('node:test');
const assert = require('node:assert/strict');
const { isNewerVersion, parseUpdateRelease } = require('../out/main/updateRelease.js');

test('compares each semantic version component numerically', () => {
  assert.equal(isNewerVersion('0.12.0', '0.11.9'), true);
  assert.equal(isNewerVersion('0.11.10', '0.11.9'), true);
  assert.equal(isNewerVersion('0.11.2', '0.11.2'), false);
  assert.equal(isNewerVersion('0.10.99', '0.11.0'), false);
});

test('accepts a valid GitHub release and rejects malformed versions', () => {
  assert.deepEqual(parseUpdateRelease({
    tag_name: 'v1.2.3',
    html_url: 'https://example.test/release',
    assets: [{ name: 'app.AppImage', browser_download_url: 'https://example.test/app', digest: `sha256:${'a'.repeat(64)}` }, { name: 4 }],
  }), {
    version: '1.2.3',
    pageUrl: 'https://example.test/release',
    assets: [{ name: 'app.AppImage', browser_download_url: 'https://example.test/app', digest: `sha256:${'a'.repeat(64)}` }],
  });
  assert.equal(parseUpdateRelease({ tag_name: 'nightly', html_url: 'https://example.test', assets: [] }), null);
});
