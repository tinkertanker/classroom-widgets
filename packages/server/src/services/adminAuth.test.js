const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createAdminAuth, SESSION_COOKIE } = require('./adminAuth');

// Ways admin auth can fail, written before the implementation:
// - a cookie whose payload, signature or format was tampered with is accepted
// - a cookie signed with another (or an empty, publicly computable) secret is accepted
// - an expired cookie is accepted
// - removing someone from the allowlist does not revoke their live cookie
// - a Google token that fails verification, or whose email is unverified, signs in
// - a domain allowlist matches look-alike domains, or personal Google accounts
//   registered with a work address (no `hd` claim)
// - an empty allowlist lets everyone in instead of no one
// - Google sign-in is attempted when no client ID is configured
// - token sign-in works while ADMIN_TOKEN is unset

const NOW = Date.UTC(2026, 9, 6, 12);

function createAuth(env = {}, { claims, verifyError } = {}) {
  const verifierCalls = [];
  const auth = createAdminAuth({
    env: {
      GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
      ADMIN_SESSION_SECRET: 'test-session-secret-that-is-long-enough',
      ...env
    },
    verifyGoogleIdToken: async (credential, audience) => {
      verifierCalls.push({ credential, audience });
      if (verifyError) throw verifyError;
      return claims;
    },
    now: () => auth.clock
  });
  auth.clock = NOW;
  return { auth, verifierCalls };
}

const cookieHeader = (value) => `other=1; ${SESSION_COOKIE}=${value}`;

function forgeCookie(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

test('a cookie issued to an allowed admin reads back while it is valid', () => {
  const { auth } = createAuth({ ADMIN_EMAILS: 'Admin@Example.com' });
  const value = auth.issueSessionCookie({ email: 'admin@example.com' });
  assert.deepEqual(auth.readSession(cookieHeader(value)), { email: 'admin@example.com' });
});

test('tampered, malformed and foreign-secret cookies are rejected without throwing', () => {
  const { auth } = createAuth({ ADMIN_EMAILS: 'admin@example.com,other@example.com' });
  const value = auth.issueSessionCookie({ email: 'admin@example.com' });
  const [body, signature] = value.split('.');
  const swapped = Buffer.from(JSON.stringify({
    ...JSON.parse(Buffer.from(body, 'base64url').toString()),
    email: 'other@example.com'
  })).toString('base64url');

  const rejected = [
    `${swapped}.${signature}`,
    `${body}.`,
    `${body}`,
    `${body}.${signature}x`,
    '...',
    '%%%.%%%',
    `${Buffer.from('not json').toString('base64url')}.${signature}`,
    forgeCookie({ email: 'admin@example.com', exp: NOW + 60_000 }, 'some-other-secret')
  ];
  for (const candidate of rejected) {
    assert.equal(auth.readSession(cookieHeader(candidate)), null, candidate);
  }
  assert.equal(auth.readSession(undefined), null);
  assert.equal(auth.readSession(''), null);
});

test('a blank session secret is never used to sign cookies', () => {
  const { auth } = createAuth({ ADMIN_EMAILS: 'admin@example.com', ADMIN_SESSION_SECRET: '   ' });
  const forged = forgeCookie({ email: 'admin@example.com', exp: NOW + 60_000 }, '   ');
  const forgedEmpty = forgeCookie({ email: 'admin@example.com', exp: NOW + 60_000 }, '');
  assert.equal(auth.readSession(cookieHeader(forged)), null);
  assert.equal(auth.readSession(cookieHeader(forgedEmpty)), null);

  // A per-process random secret still lets sign-in work until a restart.
  const value = auth.issueSessionCookie({ email: 'admin@example.com' });
  assert.deepEqual(auth.readSession(cookieHeader(value)), { email: 'admin@example.com' });
});

test('an expired cookie is rejected', () => {
  const { auth } = createAuth({ ADMIN_EMAILS: 'admin@example.com' });
  const value = auth.issueSessionCookie({ email: 'admin@example.com' });
  auth.clock = NOW + auth.sessionMaxAgeMs + 1;
  assert.equal(auth.readSession(cookieHeader(value)), null);
});

test('removing an email from the allowlist revokes its existing cookie', () => {
  const secret = 'shared-secret-across-restarts';
  const before = createAuth({ ADMIN_EMAILS: 'admin@example.com', ADMIN_SESSION_SECRET: secret }).auth;
  const value = before.issueSessionCookie({ email: 'admin@example.com' });

  const after = createAuth({ ADMIN_EMAILS: 'someone-else@example.com', ADMIN_SESSION_SECRET: secret }).auth;
  assert.equal(after.readSession(cookieHeader(value)), null);
});

test('Google sign-in accepts a verified allowlisted email, case-insensitively', async () => {
  const { auth, verifierCalls } = createAuth(
    { ADMIN_EMAILS: ' admin@example.com , ' },
    { claims: { email: 'ADMIN@example.com', email_verified: true } }
  );
  assert.deepEqual(await auth.loginWithGoogle('credential'), { email: 'admin@example.com' });
  assert.deepEqual(verifierCalls, [{ credential: 'credential', audience: 'client-id.apps.googleusercontent.com' }]);
});

test('Google sign-in rejects failed verification, unverified email and unlisted email', async () => {
  const env = { ADMIN_EMAILS: 'admin@example.com' };
  assert.equal(await createAuth(env, { verifyError: new Error('Wrong recipient') }).auth.loginWithGoogle('x'), null);
  assert.equal(await createAuth(env, { claims: { email: 'admin@example.com', email_verified: false } }).auth.loginWithGoogle('x'), null);
  assert.equal(await createAuth(env, { claims: { email: 'admin@example.com' } }).auth.loginWithGoogle('x'), null);
  assert.equal(await createAuth(env, { claims: { email: 'intruder@example.com', email_verified: true } }).auth.loginWithGoogle('x'), null);
  assert.equal(await createAuth(env, { claims: null }).auth.loginWithGoogle('x'), null);
});

test('a domain allowlist needs a Workspace account on exactly that domain', async () => {
  const env = { ADMIN_EMAIL_DOMAINS: 'Example.com' };
  const login = async (claims) => (await createAuth(env, { claims }).auth.loginWithGoogle('x'))?.email ?? null;

  assert.equal(await login({ email: 'teacher@example.com', email_verified: true, hd: 'example.com' }), 'teacher@example.com');
  // Personal Google account registered with a work address: no hd claim.
  assert.equal(await login({ email: 'teacher@example.com', email_verified: true }), null);
  assert.equal(await login({ email: 'x@example.com.evil.test', email_verified: true, hd: 'example.com.evil.test' }), null);
  assert.equal(await login({ email: 'x@evil-example.com', email_verified: true, hd: 'evil-example.com' }), null);
  // hd and email domain must agree.
  assert.equal(await login({ email: 'x@other.test', email_verified: true, hd: 'example.com' }), null);
});

test('an empty allowlist lets nobody in', async () => {
  const { auth } = createAuth({}, { claims: { email: 'admin@example.com', email_verified: true, hd: 'example.com' } });
  assert.equal(await auth.loginWithGoogle('x'), null);
  assert.equal(auth.readSession(cookieHeader(auth.issueSessionCookie({ email: 'admin@example.com' }))), null);
});

test('Google sign-in is refused without a client ID and never calls the verifier', async () => {
  const { auth, verifierCalls } = createAuth(
    { ADMIN_EMAILS: 'admin@example.com', GOOGLE_CLIENT_ID: '' },
    { claims: { email: 'admin@example.com', email_verified: true } }
  );
  assert.equal(auth.googleClientId, null);
  assert.equal(await auth.loginWithGoogle('x'), null);
  assert.equal(verifierCalls.length, 0);
});

test('token sign-in needs ADMIN_TOKEN configured and matched', (t) => {
  const previous = process.env.ADMIN_TOKEN;
  t.after(() => {
    if (previous === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = previous;
  });

  delete process.env.ADMIN_TOKEN;
  const { auth } = createAuth();
  assert.equal(auth.tokenLoginEnabled(), false);
  assert.equal(auth.loginWithToken('undefined'), null);
  assert.equal(auth.loginWithToken(''), null);

  process.env.ADMIN_TOKEN = 'correct-token';
  assert.equal(auth.tokenLoginEnabled(), true);
  assert.equal(auth.loginWithToken('wrong-token'), null);
  const identity = auth.loginWithToken('correct-token');
  assert.deepEqual(identity, { email: 'admin-token' });

  // Token sessions survive without an email allowlist, and die with the token.
  const value = auth.issueSessionCookie(identity);
  assert.deepEqual(auth.readSession(cookieHeader(value)), identity);
  delete process.env.ADMIN_TOKEN;
  assert.equal(auth.readSession(cookieHeader(value)), null);
});
