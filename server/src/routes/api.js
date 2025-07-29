const { LIMITS } = require('../config/constants');

/**
 * Setup API routes
 */
module.exports = function setupApiRoutes(app, sessionManager) {
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date(),
      sessions: sessionManager.sessions.size,
      uptime: process.uptime()
    });
  });

  // Session Management APIs
  app.post('/api/sessions/create', async (req, res, next) => {
    try {
      const session = sessionManager.createSession();
      
      res.json({ 
        code: session.code, 
        success: true 
      });
    } catch (error) {
      next(error);
    }
  });

  // Check if session exists and get active rooms
  app.get('/api/sessions/:code/exists', (req, res) => {
    const { code } = req.params;
    const session = sessionManager.getSession(code);
    
    if (session) {
      res.json({ 
        exists: true, 
        activeRooms: session.getActiveRoomTypes(),
        participantCount: session.getParticipantCount(),
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      });
    } else {
      res.json({ exists: false });
    }
  });

  // Get session details
  app.get('/api/sessions/:code', (req, res) => {
    const { code } = req.params;
    const session = sessionManager.getSession(code);
    
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }
    
    res.json(session.toJSON());
  });

  // Legacy room creation endpoint (for backward compatibility)
  app.post('/api/rooms/create', async (req, res, next) => {
    try {
      const code = generateRoomCode(sessionManager.rooms);
      const room = new PollRoom(code);
      sessionManager.rooms.set(code, room);
      
      res.json({ 
        code, 
        success: true 
      });
    } catch (error) {
      next(error);
    }
  });

  // Legacy room exists endpoint
  app.get('/api/rooms/:code/exists', (req, res) => {
    const { code } = req.params;
    const room = sessionManager.rooms.get(code);
    
    if (!room) {
      return res.json({ exists: false });
    }
    
    let roomType = null;
    if (room.getType) {
      roomType = room.getType();
    } else {
      // Legacy type detection
      if (room instanceof PollRoom) roomType = 'poll';
      else if (room instanceof LinkShareRoom) roomType = 'linkShare';
      else if (room instanceof RTFeedbackRoom) roomType = 'rtfeedback';
      else if (room instanceof QuestionsRoom) roomType = 'questions';
    }
    
    res.json({ 
      exists: true, 
      roomType 
    });
  });

  // Server statistics endpoint
  app.get('/api/stats', (req, res) => {
    const stats = {
      sessions: {
        total: sessionManager.sessions.size,
        withParticipants: 0,
        activeRooms: 0
      },
      legacyRooms: sessionManager.rooms.size,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
    
    // Calculate session statistics
    sessionManager.sessions.forEach(session => {
      if (session.getParticipantCount() > 0) {
        stats.sessions.withParticipants++;
      }
      stats.sessions.activeRooms += session.activeRooms.size;
    });
    
    res.json(stats);
  });

  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ 
      error: 'API endpoint not found' 
    });
  });
};