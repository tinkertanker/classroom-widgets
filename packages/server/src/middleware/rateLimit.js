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
   * @returns {{ allowed: boolean, retryAfter?: number }}
   */
  return (key) => {
    const now = Date.now();
    const data = windows.get(key);

    if (!data || now - data.windowStart > limit.windowMs) {
      windows.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }

    data.count++;
    if (data.count > limit.max) {
      return { allowed: false, retryAfter: limit.windowMs - (now - data.windowStart) };
    }
    return { allowed: true };
  };
};

/**
 * Express middleware limiting requests per client IP.
 * @param {{ windowMs: number, max: number }} limit
 */
const ipRateLimit = (limit) => {
  const check = createWindowCounter(limit);

  return (req, res, next) => {
    const ip = getClientIp(req.headers, req.socket && req.socket.remoteAddress);
    const result = check(ip);
    if (result.allowed) {
      return next();
    }

    const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfter / 1000));
    res.set('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
      retryAfter: result.retryAfter
    });
  };
};

module.exports = {
  createWindowCounter,
  getClientIp,
  ipRateLimit,
  pendingCleanupHandles,
  stopRateLimiterCleanup
};
