const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { isValidAdminToken } = require('../utils/adminToken');
const { logger } = require('../utils/logger');

const SESSION_COOKIE = 'cw_admin';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
// Identity recorded for sessions opened with ADMIN_TOKEN rather than Google.
const TOKEN_IDENTITY = 'admin-token';

const parseList = (value) => (value || '')
  .split(',')
  .map(item => item.trim().toLowerCase())
  .filter(Boolean);

let googleClient = null;
async function verifyWithGoogle(credential, audience) {
  googleClient = googleClient || new OAuth2Client();
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience });
  return ticket.getPayload();
}

function readCookie(header, name) {
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index !== -1 && part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return null;
}

/**
 * Admin sign-in for the usage dashboard.
 *
 * Google Identity Services gives the browser an ID token, which is verified
 * here and checked against ADMIN_EMAILS / ADMIN_EMAIL_DOMAINS. ADMIN_TOKEN is
 * accepted too, for local development and scripts. Either way the browser
 * then holds a short-lived HMAC-signed cookie, re-checked against the
 * allowlist on every request so removing an email revokes access.
 */
function createAdminAuth({ env = process.env, verifyGoogleIdToken = verifyWithGoogle, now = Date.now } = {}) {
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim() || null;
  const allowedEmails = new Set(parseList(env.ADMIN_EMAILS));
  const allowedDomains = new Set(parseList(env.ADMIN_EMAIL_DOMAINS));

  let secret = env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) {
    // An empty key would let anyone compute valid signatures.
    secret = crypto.randomBytes(32).toString('hex');
    if (googleClientId) {
      logger.warn('adminAuth', 'ADMIN_SESSION_SECRET is unset; admin sign-ins will not survive a restart');
    }
  }

  const sign = (body) => crypto.createHmac('sha256', secret).update(body).digest('base64url');

  // Workspace accounts carry an `hd` claim; a personal Google account
  // registered with a work address does not, so it never matches a domain.
  const isAllowedGoogleAccount = (email, hostedDomain) => {
    if (allowedEmails.has(email)) return true;
    const domain = email.slice(email.lastIndexOf('@') + 1);
    return typeof hostedDomain === 'string'
      && hostedDomain.toLowerCase() === domain
      && allowedDomains.has(domain);
  };

  const isStillAllowed = ({ email, hd }) => {
    if (email === TOKEN_IDENTITY) return isValidAdminToken(process.env.ADMIN_TOKEN);
    return isAllowedGoogleAccount(email, hd);
  };

  return {
    googleClientId,
    sessionMaxAgeMs: SESSION_MAX_AGE_MS,

    tokenLoginEnabled() {
      return isValidAdminToken(process.env.ADMIN_TOKEN);
    },

    async loginWithGoogle(credential) {
      if (!googleClientId || typeof credential !== 'string' || !credential) return null;
      let claims;
      try {
        claims = await verifyGoogleIdToken(credential, googleClientId);
      } catch (error) {
        logger.warn('adminAuth', 'Rejected Google ID token', { message: error?.message });
        return null;
      }
      if (!claims || claims.email_verified !== true || typeof claims.email !== 'string') return null;

      const email = claims.email.toLowerCase();
      if (!isAllowedGoogleAccount(email, claims.hd)) {
        logger.warn('adminAuth', 'Google account is not on the admin allowlist', { email });
        return null;
      }
      return typeof claims.hd === 'string' ? { email, hd: claims.hd.toLowerCase() } : { email };
    },

    loginWithToken(token) {
      return isValidAdminToken(token) ? { email: TOKEN_IDENTITY } : null;
    },

    issueSessionCookie(identity) {
      const body = Buffer.from(JSON.stringify({ ...identity, exp: now() + SESSION_MAX_AGE_MS })).toString('base64url');
      return `${body}.${sign(body)}`;
    },

    /** Returns `{ email }` for a valid, unexpired, still-allowed session, else null. */
    readSession(cookieHeader) {
      const value = readCookie(cookieHeader, SESSION_COOKIE);
      if (!value) return null;
      const [body, signature, extra] = value.split('.');
      if (!body || !signature || extra !== undefined) return null;

      const expected = Buffer.from(sign(body));
      const candidate = Buffer.from(signature);
      if (candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) return null;

      let payload;
      try {
        payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      } catch {
        return null;
      }
      if (!payload || typeof payload.email !== 'string' || typeof payload.exp !== 'number') return null;
      if (payload.exp <= now() || !isStillAllowed(payload)) return null;
      return { email: payload.email };
    }
  };
}

module.exports = { createAdminAuth, SESSION_COOKIE };
