const crypto = require('crypto');

/**
 * Check whether a presented token matches the configured ADMIN_TOKEN.
 * Returns false when ADMIN_TOKEN is unset/blank or the candidate is not a
 * string; compares in constant time otherwise.
 */
function isValidAdminToken(token) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || adminToken.trim() === '') {
    return false;
  }
  if (typeof token !== 'string') {
    return false;
  }
  const expected = Buffer.from(adminToken);
  const candidate = Buffer.from(token);
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

module.exports = { isValidAdminToken };
