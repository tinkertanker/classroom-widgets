const express = require('express');
const { isValidSessionCode } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { ipMissRateLimit } = require('../middleware/rateLimit');
const serverConfig = require('../config/server.config');
const voiceCommandRoutes = require('./voiceCommand');
const { createShortenRouter } = require('./shorten');

/**
 * API routes for RESTful endpoints
 */
module.exports = (sessionManager) => {
  const router = express.Router();

  /**
   * Get server statistics
   */
  router.get('/stats', (req, res) => {
    const stats = sessionManager.getStats();
    res.json({
      success: true,
      data: stats
    });
  });

  /**
   * Check if session code exists. This is an unauthenticated oracle, so
   * misses are limited per IP to make enumerating live codes impractical;
   * hits are not counted so a classroom behind one NAT can all join.
   */
  router.get('/sessions/:code/exists', ipMissRateLimit(serverConfig.HTTP_RATE_LIMITS.SESSION_EXISTS), (req, res) => {
    const { code } = req.params;

    const exists = isValidSessionCode(code) && sessionManager.getSession(code) !== undefined;
    if (!exists) {
      req.rateLimitMiss();
    }
    res.json({
      success: true,
      exists
    });
  });

  /**
   * Admin: force cleanup of inactive sessions/rooms.
   * Operator endpoint (no in-app caller) — documented in docs/architecture.md,
   * requires the ADMIN_TOKEN bearer token.
   */
  router.post('/admin/cleanup', asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken || adminToken.trim() === '' || authHeader !== `Bearer ${adminToken}`) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    sessionManager.cleanupInactiveSessions();
    const stats = sessionManager.getStats();

    res.json({
      success: true,
      message: 'Cleanup completed',
      stats
    });
  }));

  /**
   * Voice command processing endpoint
   */
  router.use('/voice-command', voiceCommandRoutes);
  router.use('/shorten', createShortenRouter());

  return router;
};
