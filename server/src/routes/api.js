const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { isValidSessionCode, isValidRoomCode } = require('../middleware/validation');
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
   * Get session information
   */
  router.get('/sessions/:code', asyncHandler(async (req, res) => {
    const { code } = req.params;
    
    if (!isValidSessionCode(code)) {
      throw new ValidationError('Invalid session code format');
    }
    
    const session = sessionManager.getSession(code);
    if (!session) {
      throw new NotFoundError('Session not found');
    }
    
    res.json({
      success: true,
      data: {
        code: session.code,
        participantCount: session.getParticipantCount(),
        activeRooms: session.getActiveRooms(),
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      }
    });
  }));

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
   * Get room information (legacy support)
   */
  router.get('/rooms/:code', asyncHandler(async (req, res) => {
    const { code } = req.params;
    
    if (!isValidRoomCode(code)) {
      throw new ValidationError('Invalid room code format');
    }
    
    const room = sessionManager.rooms.get(code);
    if (!room) {
      throw new NotFoundError('Room not found');
    }
    
    res.json({
      success: true,
      data: {
        code: room.code,
        type: room.getType ? room.getType() : 'unknown',
        participantCount: room.getParticipantCount ? room.getParticipantCount() : 0,
        isActive: room.isActive !== undefined ? room.isActive : true,
        createdAt: room.createdAt
      }
    });
  }));

  /**
   * Check if room code is available
   */
  router.get('/check-code/:code', (req, res) => {
    const { code } = req.params;
    
    const isAvailable = sessionManager.isRoomCodeAvailable(code);
    res.json({
      success: true,
      available: isAvailable
    });
  });

  /**
   * Get widget types and capabilities
   */
  router.get('/widgets', (req, res) => {
    res.json({
      success: true,
      data: {
        widgets: [
          {
            type: 'poll',
            name: 'Poll',
            description: 'Create interactive polls',
            features: ['multiple-choice', 'real-time-results', 'anonymous-voting']
          },
          {
            type: 'linkShare',
            name: 'Link Share',
            description: 'Collect links from participants',
            features: ['url-validation', 'real-time-collection', 'moderation']
          },
          {
            type: 'rtfeedback',
            name: 'Real-time Feedback',
            description: 'Gauge understanding in real-time',
            features: ['difficulty-scale', 'anonymous-feedback', 'live-visualization']
          },
          {
            type: 'questions',
            name: 'Q&A',
            description: 'Collect and manage questions',
            features: ['question-submission', 'mark-as-answered', 'moderation']
          }
        ]
      }
    });
  });

  /**
   * Voice command processing endpoint
   */
  router.use('/voice-command', voiceCommandRoutes);

  /**
   * Clean up inactive sessions (admin endpoint)
   */
  router.post('/admin/cleanup', asyncHandler(async (req, res) => {
    // In production, this should be protected with authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
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
   * API documentation endpoint
   */
  router.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Classroom Widgets API',
      version: '2.0.0',
      endpoints: {
        stats: {
          method: 'GET',
          path: '/api/stats',
          description: 'Get server statistics'
        },
        sessionInfo: {
          method: 'GET',
          path: '/api/sessions/:code',
          description: 'Get session information'
        },
        sessionExists: {
          method: 'GET',
          path: '/api/sessions/:code/exists',
          description: 'Check if session exists'
        },
        roomInfo: {
          method: 'GET',
          path: '/api/rooms/:code',
          description: 'Get room information (legacy)'
        },
        checkCode: {
          method: 'GET',
          path: '/api/check-code/:code',
          description: 'Check if code is available'
        },
        widgets: {
          method: 'GET',
          path: '/api/widgets',
          description: 'Get available widget types'
        }
      }
    });
  });

  return router;
};