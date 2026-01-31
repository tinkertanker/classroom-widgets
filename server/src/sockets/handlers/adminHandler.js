const { logger } = require('../../utils/logger');

/**
 * Handle admin related socket events
 * Admin interface is accessed via the student app with code "ADMIN"
 * READ-ONLY: No destructive actions allowed (weak auth)
 */
module.exports = function adminHandler(io, socket, sessionManager) {

  // Admin requests all sessions data (read-only)
  socket.on('admin:getSessions', (data, callback) => {
    logger.info('admin:getSessions', 'Admin requested sessions list');

    try {
      const sessions = [];

      // Iterate over all sessions and build summary data
      sessionManager.sessions.forEach((session, code) => {
        const sessionData = {
          code: session.code,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          hasHost: !!session.hostSocketId,
          participantCount: session.getParticipantCount(),
          participants: session.getParticipants().map(p => ({
            name: p.name,
            joinedAt: p.joinedAt
          })),
          activeRooms: session.getActiveRooms().map(room => ({
            roomType: room.roomType,
            widgetId: room.widgetId,
            isActive: room.room?.isActive || false,
            // Include type-specific data summaries
            ...(room.roomType === 'poll' && room.room?.pollData ? {
              pollQuestion: room.room.pollData.question,
              totalVotes: room.room.results?.totalVotes || 0
            } : {}),
            ...(room.roomType === 'questions' ? {
              questionCount: room.room?.questions?.length || 0
            } : {}),
            ...(room.roomType === 'linkShare' ? {
              submissionCount: room.room?.submissions?.length || 0
            } : {}),
            ...(room.roomType === 'rtfeedback' ? {
              responseCount: Object.keys(room.room?.responses || {}).length
            } : {})
          }))
        };
        sessions.push(sessionData);
      });

      // Sort by lastActivity (most recent first)
      sessions.sort((a, b) => b.lastActivity - a.lastActivity);

      const stats = sessionManager.getStats();

      if (callback) {
        callback({
          success: true,
          sessions,
          stats
        });
      }
    } catch (error) {
      logger.error('admin:getSessions', error);
      if (callback) {
        callback({
          success: false,
          error: 'Failed to fetch sessions'
        });
      }
    }
  });

  // Admin subscribes to real-time updates
  socket.on('admin:subscribe', () => {
    logger.info('admin:subscribe', 'Admin subscribed to updates');
    socket.join('admin:updates');
  });

  // Admin unsubscribes from updates
  socket.on('admin:unsubscribe', () => {
    logger.info('admin:unsubscribe', 'Admin unsubscribed from updates');
    socket.leave('admin:updates');
  });
};
