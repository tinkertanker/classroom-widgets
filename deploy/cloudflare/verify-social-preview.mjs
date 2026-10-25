#!/usr/bin/env node
// Real HTTP checks against wrangler dev or production, not a mocked ASSETS binding.
// node verify-social-preview.mjs http://127.0.0.1:8787
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const base = process.argv[2];
assert(base, 'Supply the web origin to check');
const videoPath = '/og-video-v2.mp4';
const expected = readFileSync(fileURLToPath(new URL('../../packages/teacher/public/og-video-v2.mp4', import.meta.url)));
const poster = readFileSync(fileURLToPath(new URL('../../packages/teacher/public/og-image-v2.jpg', import.meta.url)));
const results = [];
const get = (path, headers = {}, method = 'GET') => fetch(new URL(path, base), {
  method, headers, redirect: 'manual', signal: AbortSignal.timeout(10000),
});
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: String(error) });
    console.error(`FAIL ${name}: ${error}`);
  }
}
// Allow the local runtime to start in CI.
for (let attempt = 0; ; attempt++) {
  try { await (await get('/')).arrayBuffer(); break; }
  catch (error) {
    if (attempt === 29) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

let etag;
await check('full MP4 has original bytes, MIME, length and range support', async () => {
  const res = await get(videoPath);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'video/mp4');
  assert.equal(res.headers.get('content-length'), String(expected.length));
  assert.equal(res.headers.get('accept-ranges'), 'bytes');
  etag = res.headers.get('etag');
  assert.ok(etag);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), expected);
});
for (const [range, start, end] of [
  ['bytes=0-1', 0, 1],
  ['bytes=103-319', 103, 319],
  ['bytes=230500-', 230500, expected.length - 1],
  ['bytes=-17', expected.length - 17, expected.length - 1],
  ['bytes=230520-999999', 230520, expected.length - 1],
]) {
  await check(`exact partial bytes for ${range}`, async () => {
    const res = await get(videoPath, { Range: range });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-range'), `bytes ${start}-${end}/${expected.length}`);
    assert.equal(res.headers.get('content-length'), String(end - start + 1));
    assert.equal(res.headers.get('accept-ranges'), 'bytes');
    assert.equal(res.headers.get('content-type'), 'video/mp4');
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), expected.subarray(start, end + 1));
  });
}
for (const range of [`bytes=${expected.length}-`, 'bytes=-0']) {
  await check(`unsatisfiable ${range}`, async () => {
    const res = await get(videoPath, { Range: range });
    assert.equal(res.status, 416);
    assert.equal(res.headers.get('content-range'), `bytes */${expected.length}`);
    assert.equal((await res.arrayBuffer()).byteLength, 0);
  });
}
for (const range of ['bytes=9-2', 'bytes=abc', 'bytes=0-1,5-8', 'items=0-1']) {
  await check(`ignored invalid/unsupported ${range}`, async () => {
    const res = await get(videoPath, { Range: range });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-range'), null);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), expected);
  });
}
await check('If-Range uses the current strong ETag only', async () => {
  assert.ok(etag);
  for (const [validator, status] of [[etag, 206], ['"stale"', 200], [`W/${etag}`, 200]]) {
    const res = await get(videoPath, { Range: 'bytes=103-319', 'If-Range': validator });
    assert.equal(res.status, status);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), status === 206 ? expected.subarray(103, 320) : expected);
  }
});
await check('conditional GET remains 304, including with Range', async () => {
  assert.ok(etag);
  const res = await get(videoPath, { 'If-None-Match': etag, Range: 'bytes=0-1' });
  assert.equal(res.status, 304);
  assert.equal((await res.arrayBuffer()).byteLength, 0);
});
await check('HEAD ignores Range and has no body', async () => {
  const res = await get(videoPath, { Range: 'bytes=0-1' }, 'HEAD');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-length'), String(expected.length));
  assert.equal(res.headers.get('accept-ranges'), 'bytes');
  assert.equal(res.headers.get('content-range'), null);
  assert.equal((await res.arrayBuffer()).byteLength, 0);
});
await check('metadata and static image fallback are preserved', async () => {
  const html = await (await get('/')).text();
  assert.ok(html.includes(`property="og:video" content="https://widgets.tk.sg${videoPath}"`));
  assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(html.includes('property="og:image" content="https://widgets.tk.sg/og-image-v2.jpg"'));
  const res = await get('/og-image-v2.jpg');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), poster);
});
await check('neighboring SPA and missing hashed asset routing are unchanged', async () => {
  const spa = await get('/widgets/poll');
  assert.equal(spa.status, 200);
  assert.ok((await spa.text()).includes('<div id="root"'));
  const missing = await get('/assets/not-a-real-chunk.js');
  assert.equal(missing.status, 404);
  await missing.arrayBuffer();
});

const evidenceDir = process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR || '/tmp/classroom-widgets-social-preview';
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(join(evidenceDir, 'social-preview-http.json'), JSON.stringify({
  timestamp: new Date().toISOString(), base, results,
}, null, 2) + '\n');
console.log(`${results.filter((r) => r.ok).length}/${results.length} HTTP checks passed; evidence: ${evidenceDir}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
