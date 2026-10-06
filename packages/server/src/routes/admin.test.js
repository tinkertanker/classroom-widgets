const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { createAdminRouter } = require('./admin');
const { createAdminAuth } = require('../services/adminAuth');
const { UsageLog } = require('../services/usageLog');

// Ways the admin routes can fail, written before the implementation:
// - usage data is readable without a session cookie or the admin token
// - the session cookie is readable by page scripts, sent cross-site, sent
//   over plain HTTP in production, or scoped to the whole site
// - a failed sign-in still sets a cookie
// - sign-in attempts can be guessed without limit
// - another site can post a sign-in or sign-out on an admin's behalf
// - the page's headers block the Google sign-in popup or let it be cached
// - live figures are readable without signing in, or are cached

async function startServer(t, { secureCookies = false, claims } = {}) {
  const previousToken = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'correct-admin-token';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-route-test-'));

  const adminAuth = createAdminAuth({
    env: {
      GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
      ADMIN_EMAILS: 'admin@example.com',
      ADMIN_SESSION_SECRET: 'route-test-secret'
    },
    verifyGoogleIdToken: async (credential) => {
      if (credential !== 'good-credential') throw new Error('Invalid token');
      return claims || { email: 'admin@example.com', email_verified: true };
    }
  });
  const usageLog = new UsageLog({ dir, timeZone: 'UTC' });
  usageLog.record({ e: 'app_open', c: '0f8c2a52-2f38-4f6b-9d1e-3b7f2b9d6a10', v: 'b1f1c6f4-7f39-4a1e' });

  const app = express();
  app.use('/admin', createAdminRouter({
    adminAuth,
    usageLog,
    secureCookies,
    loginRateLimit: { windowMs: 60_000, max: 3 },
    getLiveStats: () => ({ teachersOnline: 2, activeSessions: 1, studentsConnected: 5, rooms: [] })
  }));
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  t.after(() => {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
    if (previousToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = previousToken;
  });

  const base = `http://127.0.0.1:${server.address().port}/admin`;
  const post = (route, body, headers = {}) => fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  return { base, post };
}

const sessionCookie = (response) => {
  const header = response.headers.get('set-cookie');
  return header ? header.split(';')[0] : null;
};

test('usage data needs a session cookie or the admin bearer token', async (t) => {
  const { base } = await startServer(t);

  assert.equal((await fetch(`${base}/api/usage`)).status, 401);
  assert.equal((await fetch(`${base}/api/usage`, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await fetch(`${base}/api/usage`, { headers: { Authorization: 'Bearer undefined' } })).status, 401);
  assert.equal((await fetch(`${base}/api/usage`, { headers: { Cookie: 'cw_admin=forged.value' } })).status, 401);

  const response = await fetch(`${base}/api/usage?days=7`, { headers: { Authorization: 'Bearer correct-admin-token' } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.enabled, true);
  assert.equal(body.days.length, 7);
  assert.equal(body.totals.appOpens, 1);
});

test('Google sign-in sets a locked-down cookie that unlocks usage data', async (t) => {
  const { base, post } = await startServer(t);

  const response = await post('/auth/google', { credential: 'good-credential' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, email: 'admin@example.com' });

  const header = response.headers.get('set-cookie');
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Strict/i);
  assert.match(header, /Path=\/admin/i);
  assert.doesNotMatch(header, /Secure/i);

  const cookie = sessionCookie(response);
  const usage = await fetch(`${base}/api/usage`, { headers: { Cookie: cookie } });
  assert.equal(usage.status, 200);

  const session = await (await fetch(`${base}/session`, { headers: { Cookie: cookie } })).json();
  assert.equal(session.authenticated, true);
  assert.equal(session.email, 'admin@example.com');
});

test('production cookies are Secure', async (t) => {
  const { post } = await startServer(t, { secureCookies: true });
  const response = await post('/auth/token', { token: 'correct-admin-token' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Secure/i);
});

test('failed sign-ins set no cookie and are limited per client', async (t) => {
  const { post } = await startServer(t);

  // A good sign-in does not use up the failure budget.
  assert.equal((await post('/auth/token', { token: 'correct-admin-token' })).status, 200);

  for (let i = 0; i < 3; i++) {
    const response = await post(i % 2 ? '/auth/google' : '/auth/token', i % 2 ? { credential: 'bad' } : { token: 'wrong' });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  const limited = await post('/auth/token', { token: 'correct-admin-token' });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('set-cookie'), null);
});

test('an unlisted Google account cannot sign in', async (t) => {
  const { post } = await startServer(t, { claims: { email: 'intruder@example.com', email_verified: true } });
  const response = await post('/auth/google', { credential: 'good-credential' });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('cross-site posts are refused', async (t) => {
  const { post } = await startServer(t);
  const response = await post('/auth/token', { token: 'correct-admin-token' }, { Origin: 'https://evil.test' });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal((await post('/auth/logout', {}, { Origin: 'https://evil.test' })).status, 403);
});

test('sign-out clears the cookie', async (t) => {
  const { post } = await startServer(t);
  const response = await post('/auth/logout', {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /cw_admin=;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
});

test('the dashboard page allows the Google popup and is never cached', async (t) => {
  const { base } = await startServer(t);
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('live figures need sign-in and are never cached', async (t) => {
  const { base } = await startServer(t);
  assert.equal((await fetch(`${base}/api/live`)).status, 401);
  assert.equal((await fetch(`${base}/api/live`, { headers: { Cookie: 'cw_admin=forged.value' } })).status, 401);

  const response = await fetch(`${base}/api/live`, { headers: { Authorization: 'Bearer correct-admin-token' } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await response.json()).teachersOnline, 2);
});
