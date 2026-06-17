const express = require('express');
const { isValidSessionCode } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const voiceCommandRoutes = require('./voiceCommand');

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
   * Check if session code exists
   */
  router.get('/sessions/:code/exists', (req, res) => {
    const { code } = req.params;

    if (!isValidSessionCode(code)) {
      return res.json({
        success: true,
        exists: false
      });
    }

    const exists = sessionManager.getSession(code) !== undefined;
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

  return router;
};
