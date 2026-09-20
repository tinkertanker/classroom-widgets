const net = require('net');
const serverConfig = require('../config/server.config');

// Tracks every setInterval created by rate limiters so server.js can clear
// them during graceful shutdown (prevents the event loop staying alive).
const pendingCleanupHandles = [];

/**
 * Cancel all rate-limiter cleanup timers. Called from graceful shutdown.
 */
const stopRateLimiterCleanup = () => {
  while (pendingCleanupHandles.length) {
    const handle = pendingCleanupHandles.pop();
    clearInterval(handle);
  }
};

/**
 * Resolve the client IP for a request or socket handshake.
 *
 * TRUST_PROXY is the number of reverse-proxy hops in front of the server. The
 * address that many entries from the end of X-Forwarded-For is the client;
 * with no trusted hops the header is ignored entirely because any client could
 * spoof it to escape per-IP limits.
 */
const getClientIp = (headers = {}, remoteAddress = '') => {
  const trustedHops = serverConfig.TRUST_PROXY;
  if (trustedHops > 0) {
    const forwarded = headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const hops = forwarded.split(',').map(s => s.trim()).filter(Boolean);
      const candidate = hops[hops.length - trustedHops];
      if (candidate && net.isIP(candidate)) {
        return candidate;
      }
    }
  }
  return remoteAddress || 'unknown';
};

/**
 * Fixed-window counter shared by the socket and HTTP limiters.
 * @param {{ windowMs: number, max: number }} limit
 */
const createWindowCounter = (limit) => {
  const windows = new Map();

  const cleanupHandle = setInterval(() => {
    const now = Date.now();
    windows.forEach((data, key) => {
      if (now - data.windowStart > limit.windowMs * 2) {
        windows.delete(key);
      }
    });
  }, 5 * 60 * 1000);
  if (cleanupHandle.unref) cleanupHandle.unref();
  pendingCleanupHandles.push(cleanupHandle);

  /**
   * @param {string} key
   * @param {{ consume?: boolean }} [options] - consume=false only inspects the
   *   window without counting the request
   * @returns {{ allowed: boolean, retryAfter?: number }}
   */
  const check = (key, { consume = true } = {}) => {
    const now = Date.now();
    const data = windows.get(key);

    if (!data || now - data.windowStart > limit.windowMs) {
      if (consume) windows.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }

    if (consume) data.count++;
    if (data.count > limit.max || (!consume && data.count >= limit.max)) {
      return { allowed: false, retryAfter: limit.windowMs - (now - data.windowStart) };
    }
    return { allowed: true };
  };

  return check;
};

const sendRateLimited = (res, result) => {
  const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfter / 1000));
  res.set('Retry-After', String(retryAfterSeconds));
  res.status(429).json({
    success: false,
    error: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
    retryAfter: result.retryAfter
  });
};

const requestIp = (req) => getClientIp(req.headers, req.socket && req.socket.remoteAddress);

/**
 * Express middleware limiting requests per client IP.
 * @param {{ windowMs: number, max: number }} limit
 */
const ipRateLimit = (limit) => {
  const check = createWindowCounter(limit);

  return (req, res, next) => {
    const result = check(requestIp(req));
    if (result.allowed) {
      return next();
    }
    sendRateLimited(res, result);
  };
};

/**
 * Express middleware limiting *failed* requests per client IP. Only requests
 * the handler marks via `req.rateLimitMiss()` count against the window, so a
 * classroom behind one NAT joining with valid codes is not throttled, while
 * guessing (which is almost always a miss) still is.
 * @param {{ windowMs: number, max: number }} limit
 */
const ipMissRateLimit = (limit) => {
  const check = createWindowCounter(limit);

  return (req, res, next) => {
    const ip = requestIp(req);
    const result = check(ip, { consume: false });
    if (!result.allowed) {
      return sendRateLimited(res, result);
    }
    req.rateLimitMiss = () => check(ip);
    next();
  };
};

module.exports = {
  createWindowCounter,
  getClientIp,
  ipRateLimit,
  ipMissRateLimit,
  pendingCleanupHandles,
  stopRateLimiterCleanup
};
