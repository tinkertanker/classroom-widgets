const express = require('express');
const { isValidSessionCode } = require('../middleware/validation');
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
   * Voice command processing endpoint
   */
  router.use('/voice-command', voiceCommandRoutes);

  return router;
};
