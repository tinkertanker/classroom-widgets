const crypto = require('crypto');
const { isValidAdminToken } = require('../utils/adminToken');
const { logger } = require('../utils/logger');

const SESSION_COOKIE = 'cw_admin';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
// Identity recorded for sessions opened with the ADMIN_TOKEN password.
const TOKEN_IDENTITY = 'admin-token';

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
 * The password is ADMIN_TOKEN. A correct password gives the browser a
 * short-lived HMAC-signed cookie. The cookie carries a fingerprint of the
 * token it was issued under, checked on every request, so removing or
 * changing ADMIN_TOKEN signs everyone out. The token itself is never stored
 * in the cookie.
 */
function createAdminAuth({ env = process.env, now = Date.now } = {}) {
  let secret = env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) {
    // An empty key would let anyone compute valid signatures.
    secret = crypto.randomBytes(32).toString('hex');
    if (isValidAdminToken(process.env.ADMIN_TOKEN)) {
      logger.warn('adminAuth', 'ADMIN_SESSION_SECRET is unset; admin sign-ins will not survive a restart');
    }
  }

  const sign = (body) => crypto.createHmac('sha256', secret).update(body).digest('base64url');

  // Fingerprint of the current ADMIN_TOKEN, or null when none is set.
  const tokenFingerprint = () => {
    const token = process.env.ADMIN_TOKEN;
    return isValidAdminToken(token) ? sign(`token:${token}`) : null;
  };

  const safeEqual = (a, b) => {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  };

  return {
    sessionMaxAgeMs: SESSION_MAX_AGE_MS,

    tokenLoginEnabled() {
      return isValidAdminToken(process.env.ADMIN_TOKEN);
    },

    loginWithToken(token) {
      return isValidAdminToken(token) ? { email: TOKEN_IDENTITY } : null;
    },

    issueSessionCookie(identity) {
      const payload = { ...identity, tf: tokenFingerprint(), exp: now() + SESSION_MAX_AGE_MS };
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return `${body}.${sign(body)}`;
    },

    /** Returns `{ email }` for a valid, unexpired session under the current ADMIN_TOKEN, else null. */
    readSession(cookieHeader) {
      const value = readCookie(cookieHeader, SESSION_COOKIE);
      if (!value) return null;
      const [body, signature, extra] = value.split('.');
      if (!body || !signature || extra !== undefined) return null;

      if (!safeEqual(signature, sign(body))) return null;

      let payload;
      try {
        payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      } catch {
        return null;
      }
      if (!payload || payload.email !== TOKEN_IDENTITY || typeof payload.exp !== 'number') return null;
      if (payload.exp <= now()) return null;
      const current = tokenFingerprint();
      if (!current || typeof payload.tf !== 'string' || !safeEqual(payload.tf, current)) return null;
      return { email: payload.email };
    }
  };
}

module.exports = { createAdminAuth, SESSION_COOKIE };
