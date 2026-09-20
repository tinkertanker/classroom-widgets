const { LIMITS } = require('../config/constants');
const { logger } = require('../utils/logger');
const {
  createWindowCounter,
  getClientIp,
  pendingCleanupHandles,
  stopRateLimiterCleanup
} = require('./rateLimit');

/**
 * Socket authentication middleware
 */
const socketAuth = (sessionManager) => {
  return (socket, next) => {
    // Add session manager reference to socket
    socket.sessionManager = sessionManager;

    socket.clientIP = getClientIp(socket.handshake.headers, socket.handshake.address);

    // Initialize socket metadata
    socket.metadata = {
      joinedAt: Date.now(),
      sessionCode: null,
      isHost: false,
      participantInfo: null
    };

    // Validate connection limits
    const currentStats = sessionManager.getStats();
    if (currentStats.totalParticipants >= LIMITS.MAX_TOTAL_PARTICIPANTS) {
      return next(new Error('Server is at capacity. Please try again later.'));
    }

    next();
  };
};

/**
 * Event-specific rate limits
 * Defines limits per event type to prevent abuse.
 *
 * `scope: 'ip'` counts across every connection from the same client IP so a
 * client cannot escape the limit by reconnecting; the default scope is the
 * individual socket connection.
 */
const EVENT_RATE_LIMITS = {
  // Session creation / host reclaim - 30 per minute per IP. Legitimate hosts
  // create one session (plus the odd reconnect); this stops a single client
  // from filling MAX_SESSIONS with orphan sessions.
  'session:create': { windowMs: 60_000, max: 30, scope: 'ip' },

  // Session join - 10 per 10 seconds per connection (slows code guessing)
  'session:join': { windowMs: 10_000, max: 10 },

  // Failed joins (unknown code) - 60 per minute per IP, so reconnecting does
  // not reset the guessing budget. Successful joins never consume it.
  'session:join:miss': { windowMs: 60_000, max: 60, scope: 'ip' },

  // Poll voting - 2 requests per second (prevent rapid vote changes)
  'session:poll:vote': { windowMs: 1000, max: 2 },

  // Link submissions - 3 requests per 5 seconds
  'session:linkShare:submit': { windowMs: 5000, max: 3 },

  // RT Feedback - 5 requests per 500ms (allow smooth slider updates)
  'session:rtfeedback:submit': { windowMs: 500, max: 5 },

  // Question submissions - 2 requests per 3 seconds
  'session:questions:submit': { windowMs: 3000, max: 2 },

  // Activity answers - 3 per 2 seconds (each submit evaluates the payload)
  'session:activity:submit': { windowMs: 2000, max: 3 },

  // Activity retry - 2 per 2 seconds
  'session:activity:retry': { windowMs: 2000, max: 2 },

  // Activity state refresh - 5 per second
  'activity:requestState': { windowMs: 1000, max: 5 }
};

/**
 * Rate limiting middleware factory
 * Creates a per-event rate limiter that tracks requests per client.
 *
 * Fails closed: an event with no entry in EVENT_RATE_LIMITS is rejected (and
 * logged once) so a typo or missing config can never silently disable a limit.
 */
const createEventRateLimiter = (limits = EVENT_RATE_LIMITS) => {
  const counters = new Map();
  const warnedEvents = new Set();

  const counterFor = (eventName, limit) => {
    if (!counters.has(eventName)) {
      counters.set(eventName, createWindowCounter(limit));
    }
    return counters.get(eventName);
  };

  /**
   * Check if a request should be rate limited
   * @param {Socket} socket - The socket making the request
   * @param {string} eventName - The event name being requested
   * @param {{ consume?: boolean }} [options] - `consume: false` only inspects the window
   * @returns {{ allowed: boolean, retryAfter?: number }} - Whether request is allowed
   */
  return (socket, eventName, options) => {
    const limit = limits[eventName];
    if (!limit) {
      if (!warnedEvents.has(eventName)) {
        warnedEvents.add(eventName);
        logger.error('eventRateLimiter', `No rate limit configured for event "${eventName}"; rejecting`);
      }
      return { allowed: false, retryAfter: 1000 };
    }

    const clientKey = limit.scope === 'ip'
      ? `ip:${socket.clientIP}`
      : `${socket.clientIP}-${socket.id}`;

    return counterFor(eventName, limit)(clientKey, options);
  };
};

// Create singleton rate limiter instance
const eventRateLimiter = createEventRateLimiter();

/**
 * HTTP rate limiter factory (fixed window, keyed on req.ip).
 * Returns an Express middleware for unauthenticated endpoints.
 */
const createIpRateLimiter = ({ windowMs, max }) => {
  // Map of ip -> { count, windowStart }
  const requests = new Map();

  // Cleanup stale entries every 5 minutes. Track handle so graceful shutdown can cancel it.
  const cleanupHandle = setInterval(() => {
    const now = Date.now();
    requests.forEach((data, ip) => {
      if (now - data.windowStart > windowMs * 2) {
        requests.delete(ip);
      }
    });
  }, 5 * 60 * 1000);
  if (cleanupHandle.unref) cleanupHandle.unref();
  pendingCleanupHandles.push(cleanupHandle);

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip;

    let data = requests.get(ip);
    if (!data || now - data.windowStart > windowMs) {
      data = { count: 1, windowStart: now };
      requests.set(ip, data);
      return next();
    }

    data.count++;
    if (data.count > max) {
      const retryAfterMs = windowMs - (now - data.windowStart);
      res.set('Retry-After', Math.ceil(retryAfterMs / 1000));
      return res.status(429).json({ error: 'Too many voice command requests. Please slow down.' });
    }

    next();
  };
};

module.exports = {
  socketAuth,
  eventRateLimiter,
  createEventRateLimiter,
  EVENT_RATE_LIMITS,
  createIpRateLimiter,
  stopRateLimiterCleanup
};
