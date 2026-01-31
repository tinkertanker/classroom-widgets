const { EVENTS, LIMITS } = require('../../config/constants');
const PollRoom = require('../../models/PollRoom');
const { validators } = require('../../utils/validation');
const { logger } = require('../../utils/logger');
const { createErrorResponse, createSuccessResponse, createRateLimitResponse, ERROR_CODES } = require('../../utils/errors');
const { eventRateLimiter } = require('../../middleware/socketAuth');

/**
 * Handle poll-related socket events
 */
module.exports = function pollHandler(io, socket, sessionManager, getCurrentSessionCode) {

  // Poll update handler (host only)
  socket.on(EVENTS.POLL.UPDATE, (data) => {
    logger.debug('poll:update', 'Received poll update', {
      sessionCode: data.sessionCode,
      widgetId: data.widgetId
    });

    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) {
      logger.warn('poll:update', 'Ignoring poll:update - not from host');
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('poll:update', widgetValidation.error);
      return;
    }

    const room = session.getRoom('poll', data.widgetId);
    if (!room || !(room instanceof PollRoom)) {
      logger.warn('poll:update', 'Poll room not found', { widgetId: data.widgetId });
      return;
    }

    // Use setPollData to ensure proper initialization
    room.setPollData(data.pollData);

    // Emit to both new and legacy event names for backwards compatibility
    const roomId = data.widgetId ? `poll:${data.widgetId}` : 'poll';
    const { votes, ...pollDataWithoutVotes } = room.pollData;

    const updateData = {
      pollData: pollDataWithoutVotes,
      results: room.getResults(),
      widgetId: data.widgetId
    };

    logger.debug('poll:update', 'Broadcasting poll data', { roomId: `${session.code}:${roomId}` });

    // Emit both new and legacy events
    io.to(`${session.code}:${roomId}`).emit(EVENTS.POLL.STATE_UPDATE, updateData);
    io.to(`${session.code}:${roomId}`).emit(EVENTS.POLL.DATA_UPDATE, updateData); // Legacy

    session.updateActivity();
  });


  // Student requests poll state (on join/refresh)
  socket.on(EVENTS.POLL.REQUEST_STATE, (data) => {
    // Support both 'sessionCode' (new) and 'code' (legacy)
    const sessionCode = data.sessionCode || data.code;
    const { widgetId } = data;

    // Validate input
    const sessionValidation = validators.sessionCode(sessionCode);
    if (!sessionValidation.valid) {
      logger.warn('poll:requestState', sessionValidation.error);
      return;
    }

    const widgetValidation = validators.widgetId(widgetId);
    if (!widgetValidation.valid) {
      logger.warn('poll:requestState', widgetValidation.error);
      return;
    }

    const session = sessionManager.getSession(sessionCode);

    if (session) {
      const room = session.getRoom('poll', widgetId);
      if (room && room instanceof PollRoom) {
        const { votes, ...pollDataWithoutVotes } = room.pollData;

        const stateData = {
          pollData: pollDataWithoutVotes,
          results: room.getResults(),
          widgetId: widgetId
        };

        // Emit both new and legacy events
        socket.emit(EVENTS.POLL.STATE_UPDATE, stateData);
        socket.emit(EVENTS.POLL.DATA_UPDATE, stateData); // Legacy

        // Also emit the widget's active state
        socket.emit(EVENTS.SESSION.WIDGET_STATE_CHANGED, {
          roomType: 'poll',
          widgetId: widgetId,
          isActive: room.isActive
        });
      }
    }
  });

  // Handle student vote submission (legacy event)
  socket.on('poll:vote', (data) => {
    // Support both 'sessionCode' (new) and 'code' (legacy)
    const sessionCode = data.sessionCode || data.code;
    const { widgetId, optionIndex } = data;

    const session = sessionManager.getSession(sessionCode);

    if (!session) {
      socket.emit('vote:confirmed', createErrorResponse('INVALID_SESSION'));
      return;
    }

    const room = session.getRoom('poll', widgetId);
    if (!room || !(room instanceof PollRoom)) {
      socket.emit('vote:confirmed', createErrorResponse('ROOM_NOT_FOUND'));
      return;
    }

    // Check if poll is active
    if (!room.isActive) {
      socket.emit('vote:confirmed', createErrorResponse('WIDGET_PAUSED'));
      return;
    }

    // Validate option index
    const optionCount = room.pollData?.options?.length || 0;
    const optionValidation = validators.pollOption(optionIndex, optionCount);
    if (!optionValidation.valid) {
      socket.emit('vote:confirmed', createErrorResponse('INVALID_INPUT', optionValidation.error));
      return;
    }

    // Check if participant has already voted
    const participant = session.getParticipant(socket.id);
    if (!participant) {
      socket.emit('vote:confirmed', createErrorResponse('NOT_PARTICIPANT'));
      return;
    }

    // Record vote
    if (room.vote(socket.id, optionIndex)) {
      socket.emit('vote:confirmed', createSuccessResponse());

      // Emit updated vote counts to all in the room
      const pollRoomId = widgetId ? `poll:${widgetId}` : 'poll';
      io.to(`${session.code}:${pollRoomId}`).emit(EVENTS.POLL.VOTE_UPDATE, {
        votes: room.getVoteCounts(),
        totalVotes: room.getTotalVotes(),
        widgetId: widgetId
      });
    } else {
      socket.emit('vote:confirmed', createErrorResponse('ALREADY_VOTED'));
    }

    session.updateActivity();
  });

  // Handle session-based poll vote (primary event)
  socket.on(EVENTS.POLL.VOTE, (data) => {
    const { sessionCode, widgetId, optionIndex } = data;
    logger.debug('poll:vote', 'Received vote', { sessionCode, widgetId, optionIndex });

    // Check rate limit
    const rateLimitResult = eventRateLimiter(socket, EVENTS.POLL.VOTE);
    if (!rateLimitResult.allowed) {
      socket.emit(EVENTS.POLL.VOTE_CONFIRMED, {
        ...createRateLimitResponse(rateLimitResult.retryAfter),
        widgetId
      });
      return;
    }

    const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());

    if (!session) {
      logger.warn('poll:vote', 'Session not found', { sessionCode });
      socket.emit(EVENTS.POLL.VOTE_CONFIRMED, {
        ...createErrorResponse('INVALID_SESSION'),
        widgetId
      });
      return;
    }

    const room = session.getRoom('poll', widgetId);
    if (!room || !(room instanceof PollRoom)) {
      logger.warn('poll:vote', 'Poll room not found', { widgetId });
      socket.emit(EVENTS.POLL.VOTE_CONFIRMED, {
        ...createErrorResponse('ROOM_NOT_FOUND'),
        widgetId
      });
      return;
    }

    // Check if poll is active
    if (!room.isActive) {
      logger.debug('poll:vote', 'Poll is not active', { widgetId });
      socket.emit(EVENTS.POLL.VOTE_CONFIRMED, {
        ...createErrorResponse('WIDGET_PAUSED'),
        widgetId
      });
      return;
    }

    // Validate option index
    const optionCount = room.pollData?.options?.length || 0;
    const optionValidation = validators.pollOption(optionIndex, optionCount);
    if (!optionValidation.valid) {
      socket.emit(EVENTS.POLL.VOTE_CONFIRMED, {
        ...createErrorResponse('INVALID_INPUT', optionValidation.error),
        widgetId
      });
      return;
    }

    // Check if participant exists
    const participant = session.getParticipant(socket.id);
    if (!participant) {
      logger.warn('poll:vote', 'Participant not found', { socketId: socket.id });
      socket.emit(EVENTS.POLL.VOTE_CONFIRMED, {
        ...createErrorResponse('NOT_PARTICIPANT'),
        widgetId
      });
      return;
    }

    // Record vote
    if (room.vote(socket.id, optionIndex)) {
      logger.debug('poll:vote', 'Vote recorded', { socketId: socket.id });
      socket.emit(EVENTS.POLL.VOTE_CONFIRMED, createSuccessResponse({ widgetId }));

      // Emit updated results to all in the room
      const pollRoomId = widgetId ? `poll:${widgetId}` : 'poll';
      const voteUpdateData = {
        votes: room.getVoteCounts(),
        totalVotes: room.getTotalVotes(),
        widgetId: widgetId
      };
      logger.debug('poll:vote', 'Broadcasting vote update', { roomId: `${session.code}:${pollRoomId}` });
      io.to(`${session.code}:${pollRoomId}`).emit(EVENTS.POLL.VOTE_UPDATE, voteUpdateData);
    } else {
      logger.debug('poll:vote', 'Participant already voted', { socketId: socket.id });
      socket.emit(EVENTS.POLL.VOTE_CONFIRMED, {
        ...createErrorResponse('ALREADY_VOTED'),
        widgetId
      });
    }

    session.updateActivity();
  });

};
