const { LIMITS } = require('../config/constants');
const { logger } = require('../utils/logger');
const {
  createWindowCounter,
  getClientIp,
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
   * @returns {{ allowed: boolean, retryAfter?: number }} - Whether request is allowed
   */
  return (socket, eventName) => {
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

    return counterFor(eventName, limit)(clientKey);
  };
};

// Create singleton rate limiter instance
const eventRateLimiter = createEventRateLimiter();

module.exports = {
  socketAuth,
  eventRateLimiter,
  createEventRateLimiter,
  EVENT_RATE_LIMITS,
  stopRateLimiterCleanup
};
