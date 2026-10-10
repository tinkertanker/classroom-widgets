#!/usr/bin/env node
// End-to-end check of the Cloudflare deployment (or of `wrangler dev`).
//
//   node verify.mjs --backend https://go.tk.sg --web https://widgets.tk.sg
//   node verify.mjs --backend http://127.0.0.1:8788 --web http://127.0.0.1:8787 --spoof-test --local
//
// Writes a step-by-step log and a JSON result to the evidence directory
// ($CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR, default
// /tmp/classroom-widgets-cloudflare-evidence) and exits non-zero on failure.
//
// --spoof-test sends 61 unknown-session probes with forged X-Forwarded-For
// headers; it leaves the caller's IP rate-limited on /api/sessions/*/exists
// for a minute, so only use it against production when that is acceptable.
// --local additionally proves the server keys rate limits on CF-Connecting-IP
// (only meaningful under wrangler dev, where the header is not overwritten).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
// socket.io-client comes from the teacher app, the real client of this server.
const requireFromTeacher = createRequire(resolve(here, '../../packages/teacher/package.json'));
const { io } = requireFromTeacher('socket.io-client');

const { values: opts } = parseArgs({
  options: {
    backend: { type: 'string', default: 'https://go.tk.sg' },
    web: { type: 'string' },
    origin: { type: 'string' },
    'spoof-test': { type: 'boolean', default: false },
    local: { type: 'boolean', default: false },
  },
});
const backend = opts.backend.replace(/\/$/, '');
const web = opts.web?.replace(/\/$/, '');
// The Origin the teacher app sends; it must be in the backend's CORS_ORIGINS.
const teacherOrigin = opts.origin ?? 'https://widgets.tk.sg';
const evidenceDir = process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR || '/tmp/classroom-widgets-cloudflare-evidence';
mkdirSync(evidenceDir, { recursive: true });

const results = [];
const lines = [];
const log = (s) => { console.log(s); lines.push(s); };
async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    log(`PASS ${name}${detail ? ` -- ${detail}` : ''}`);
  } catch (e) {
    results.push({ name, ok: false, detail: String(e?.message ?? e) });
    log(`FAIL ${name} -- ${e?.message ?? e}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const get = (url, init = {}) => fetch(url, { redirect: 'manual', ...init });
const withTimeout = (p, ms, what) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${what}`)), ms))]);

log(`# Cloudflare deployment check ${new Date().toISOString()}`);
log(`backend=${backend} web=${web ?? '(skipped)'} origin=${teacherOrigin}`);

await step('backend /health', async () => {
  const res = await get(`${backend}/health`);
  const body = await res.json();
  assert(res.status === 200 && body.status === 'ok', `status ${res.status} ${JSON.stringify(body)}`);
  return `uptime ${Math.round(body.uptime)}s, sessions ${body.stats.activeSessions}`;
});

await step('backend Socket.IO polling handshake', async () => {
  const res = await get(`${backend}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: teacherOrigin } });
  const text = await res.text();
  assert(res.status === 200 && text.startsWith('0{'), `status ${res.status} body ${text.slice(0, 120)}`);
  const acao = res.headers.get('access-control-allow-origin');
  assert(acao === teacherOrigin, `access-control-allow-origin=${acao}`);
  return text.slice(0, 120);
});

let teacher;
let code;
await step('teacher connects over WebSocket only and creates a session', async () => {
  teacher = io(backend, { transports: ['websocket'], extraHeaders: { Origin: teacherOrigin }, reconnection: false });
  await withTimeout(new Promise((res, rej) => { teacher.on('connect', res); teacher.on('connect_error', rej); }), 30000, 'teacher connect');
  const reply = await withTimeout(teacher.emitWithAck('session:create', {}), 15000, 'session:create');
  assert(reply.success && reply.code, JSON.stringify(reply));
  code = reply.code;
  return `transport=${teacher.io.engine.transport.name} code=${code} studentAppUrl=${reply.studentAppUrl}`;
});

await step('session exists over HTTP (same instance as the socket)', async () => {
  assert(code, 'no session code');
  const res = await get(`${backend}/api/sessions/${code}/exists`, { headers: { Origin: teacherOrigin } });
  const body = await res.json();
  assert(body.exists === true, JSON.stringify(body));
  return JSON.stringify(body);
});

await step('student joins via polling + upgrade; teacher sees the participant', async () => {
  assert(code, 'no session code');
  const update = new Promise((res) => teacher.on('session:participantUpdate', res));
  // The student app is served by the backend; in production its Origin is
  // https://go.tk.sg, which CORS_ORIGINS also lists.
  const student = io(backend, { extraHeaders: { Origin: 'https://go.tk.sg' }, reconnection: false });
  try {
    const joined = new Promise((res) => student.on('session:joined', res));
    await withTimeout(new Promise((res, rej) => { student.on('connect', res); student.on('connect_error', rej); }), 30000, 'student connect');
    student.emit('session:join', { code, name: 'Cloudflare check', studentId: `cf-check-${Date.now()}` });
    const reply = await withTimeout(joined, 15000, 'session:joined');
    assert(reply.success, JSON.stringify(reply));
    const participants = await withTimeout(update, 15000, 'participantUpdate');
    await new Promise((r) => setTimeout(r, 1500)); // let the polling transport upgrade
    return `student transport=${student.io.engine.transport.name}, update=${JSON.stringify(participants).slice(0, 100)}`;
  } finally {
    student.close();
  }
});

await step('teacher closes the session', async () => {
  if (!teacher) return 'no teacher';
  if (code) await withTimeout(teacher.emitWithAck('session:close', { sessionCode: code }).catch(() => null), 5000, 'close').catch(() => null);
  teacher.close();
  return 'closed';
});

await step('backend serves the student app at /student/', async () => {
  const res = await get(`${backend}/student/`);
  const text = await res.text();
  assert(res.status === 200 && text.includes('<div id="root"'), `status ${res.status}`);
  return res.headers.get('content-type');
});

await step('backend serves the admin dashboard at /admin', async () => {
  const res = await get(`${backend}/admin/session`);
  const body = await res.json();
  assert(res.status === 200, `status ${res.status} ${JSON.stringify(body)}`);
  return JSON.stringify(body);
});

if (opts['spoof-test']) {
  await step('forged X-Forwarded-For does not escape the per-IP limit', async () => {
    let last;
    for (let i = 0; i < 61; i++) {
      last = await get(`${backend}/api/sessions/ZZZZZ/exists`, {
        headers: { 'X-Forwarded-For': `203.0.113.${i + 1}` },
      });
      await last.arrayBuffer();
    }
    assert(last.status === 429, `61st forged probe got ${last.status}, expected 429`);
    return '61st probe rate-limited despite a new X-Forwarded-For each time';
  });
  if (opts.local) {
    await step('limit is keyed on CF-Connecting-IP (forwarded as X-Forwarded-For)', async () => {
      const res = await get(`${backend}/api/sessions/ZZZZZ/exists`, { headers: { 'CF-Connecting-IP': '198.51.100.7' } });
      await res.arrayBuffer();
      assert(res.status === 200, `got ${res.status}, expected 200 for a different client address`);
      return 'a different CF-Connecting-IP is a different client';
    });
  }
}

if (web) {
  let indexHtml = '';
  await step('web / serves the teacher SPA with nginx security headers', async () => {
    const res = await get(`${web}/`);
    indexHtml = await res.text();
    assert(res.status === 200 && indexHtml.includes('<div id="root"'), `status ${res.status}`);
    const h = (n) => res.headers.get(n);
    assert(h('x-frame-options') === 'SAMEORIGIN', `x-frame-options=${h('x-frame-options')}`);
    assert(h('x-content-type-options') === 'nosniff', `x-content-type-options=${h('x-content-type-options')}`);
    assert(h('x-xss-protection') === '1; mode=block', `x-xss-protection=${h('x-xss-protection')}`);
    return 'headers ok';
  });

  await step('web deep link falls back to index.html (SPA)', async () => {
    const res = await get(`${web}/widgets/poll`, { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } });
    const text = await res.text();
    assert(res.status === 200 && text.includes('<div id="root"'), `status ${res.status}`);
    return 'index.html';
  });

  await step('web hashed asset is cached immutably', async () => {
    const src = indexHtml.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    assert(src, 'no /assets/*.js in index.html');
    const res = await get(`${web}${src}`);
    await res.arrayBuffer();
    const cc = res.headers.get('cache-control') ?? '';
    assert(res.status === 200 && cc.includes('immutable') && cc.includes('max-age=31536000'), `status ${res.status} cache-control=${cc}`);
    return `${src} cache-control=${cc}`;
  });

  await step('web missing asset is a 404, not index.html', async () => {
    const res = await get(`${web}/assets/does-not-exist-${Date.now()}.js`);
    await res.arrayBuffer();
    assert(res.status === 404, `status ${res.status}`);
    return '404';
  });

  await step('web /admin is proxied to the backend dashboard', async () => {
    const res = await get(`${web}/admin`);
    const text = await res.text();
    assert(res.status === 200 && /admin|usage/i.test(text), `status ${res.status}`);
    const res2 = await get(`${web}/admin/session`);
    const body = await res2.json();
    return `page ${text.length} bytes; /admin/session ${JSON.stringify(body)}`;
  });

  await step('web /admin sign-in passes the same-origin check (Host kept)', async () => {
    const res = await get(`${web}/admin/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: web },
      body: JSON.stringify({ token: 'definitely-not-the-admin-token' }),
    });
    const body = await res.text();
    // 403 would mean the backend saw a different Host than the browser's origin.
    assert(res.status === 401, `status ${res.status} ${body.slice(0, 120)}`);
    return `wrong password -> ${res.status} (not 403)`;
  });
}

const failed = results.filter((r) => !r.ok);
log(`\n${results.length - failed.length}/${results.length} checks passed`);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(join(evidenceDir, 'cloudflare-check.log'), lines.join('\n') + '\n');
writeFileSync(join(evidenceDir, `cloudflare-check-${stamp}.json`), JSON.stringify({ backend, web, results }, null, 2));
log(`evidence: ${join(evidenceDir, 'cloudflare-check.log')}`);
process.exit(failed.length ? 1 : 0);
