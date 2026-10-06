const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createDownloadsRouter } = require('./downloads');

const realFetch = globalThis.fetch;
const github = 'https://github.com/tinkertanker/classroom-widgets/releases/download';
const suffixes = {
  windows: 'windows-x64-setup.exe',
  macos: 'macos.dmg',
  linux: 'linux-x86_64.AppImage'
};

function release(tag) {
  return {
    tag_name: tag,
    assets: [
      { name: `ClassroomWidgets-${tag}-windows-x64.zip`, state: 'uploaded' },
      { name: `ClassroomWidgets-${tag}-macos.zip`, state: 'uploaded' },
      { name: `ClassroomWidgets-${tag}-linux-amd64.deb`, state: 'uploaded' },
      ...Object.values(suffixes).map(suffix => ({ name: `ClassroomWidgets-${tag}-${suffix}`, state: 'uploaded' }))
    ]
  };
}

async function withServer(t, upstream, callback) {
  t.mock.method(globalThis, 'fetch', upstream);
  const app = express();
  app.use('/api/downloads', createDownloadsRouter());
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    await callback(platform => realFetch(`http://127.0.0.1:${server.address().port}/api/downloads/${platform}`, { redirect: 'manual' }));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('selects recommended files, shares concurrent lookups, and refreshes after a new release', async t => {
  let now = 1000;
  let calls = 0;
  let latest = release('v0.15.4');
  t.mock.method(Date, 'now', () => now);
  await withServer(t, async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.github.com/repos/tinkertanker/classroom-widgets/releases/latest');
    assert.ok(options.signal, 'GitHub lookup must have a timeout');
    await new Promise(resolve => setTimeout(resolve, 20));
    return { ok: true, json: async () => latest };
  }, async get => {
    const platforms = Object.keys(suffixes);
    const responses = await Promise.all(platforms.map(get));
    for (const [i, response] of responses.entries()) {
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), `${github}/v0.15.4/ClassroomWidgets-v0.15.4-${suffixes[platforms[i]]}`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal(calls, 1, 'all platforms share one GitHub request');
    latest = release('v0.16.0');
    now += 299999;
    assert.match((await get('windows')).headers.get('location'), /v0\.15\.4/);
    assert.equal(calls, 1);
    now += 1;
    assert.equal((await get('windows')).headers.get('location'), `${github}/v0.16.0/ClassroomWidgets-v0.16.0-windows-x64-setup.exe`);
    assert.equal(calls, 2);
  });
});

test('rejects unsupported platforms without requesting GitHub', async t => {
  await withServer(t, () => { throw new Error('unexpected upstream request'); }, async get => {
    for (const platform of ['android', 'constructor', '__proto__']) {
      assert.equal((await get(platform)).status, 404);
    }
  });
});

test('does not offer a missing or incomplete asset and picks up a delayed macOS upload', async t => {
  let now = 1000;
  const latest = release('v0.16.0');
  const dmg = latest.assets.find(asset => asset.name.endsWith('.dmg'));
  dmg.state = 'new';
  t.mock.method(Date, 'now', () => now);
  await withServer(t, async () => ({ ok: true, json: async () => structuredClone(latest) }), async get => {
    assert.equal((await get('macos')).status, 503);
    assert.equal((await get('linux')).status, 302);
    dmg.state = 'uploaded';
    now += 300000;
    assert.equal((await get('macos')).headers.get('location'), `${github}/v0.16.0/ClassroomWidgets-v0.16.0-macos.dmg`);
  });
});

test('upstream failures are bounded by the cache and recover after expiry', async t => {
  let now = 1000;
  let calls = 0;
  let failing = true;
  t.mock.method(Date, 'now', () => now);
  await withServer(t, async () => {
    calls++;
    return failing ? { ok: false, status: 403 } : { ok: true, json: async () => release('v0.16.0') };
  }, async get => {
    for (const platform of Object.keys(suffixes)) {
      const response = await get(platform);
      assert.equal(response.status, 502);
      assert.equal(response.headers.get('location'), null);
    }
    assert.equal(calls, 1, 'failed lookups must not exhaust GitHub rate limits');
    failing = false;
    now += 300000;
    assert.equal((await get('windows')).status, 302);
  });
});

test('network errors and malformed release metadata return an error rather than a redirect', async t => {
  for (const upstream of [
    async () => { throw new Error('network timeout'); },
    async () => ({ ok: true, json: async () => ({ assets: [] }) }),
    async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } })
  ]) {
    await withServer(t, upstream, async get => {
      const response = await get('windows');
      assert.equal(response.status, 502);
      assert.equal(response.headers.get('location'), null);
    });
  }
});
