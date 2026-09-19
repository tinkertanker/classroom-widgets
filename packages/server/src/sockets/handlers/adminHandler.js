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
          activeRooms: session.getActiveRoomEntries().map(({ roomType, widgetId, room }) => ({
            roomType,
            widgetId,
            isActive: room.isActive || false,
            // Include type-specific data summaries
            ...(roomType === 'poll' && room.pollData ? {
              pollQuestion: room.pollData.question,
              totalVotes: room.getTotalVotes() || 0
            } : {}),
            ...(roomType === 'questions' ? {
              questionCount: room.getQuestionCount() || 0
            } : {}),
            ...(roomType === 'linkShare' ? {
              submissionCount: room.getSubmissionCount() || 0
            } : {}),
            ...(roomType === 'rtfeedback' ? {
              responseCount: room.getResponseCount() || 0
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

};
