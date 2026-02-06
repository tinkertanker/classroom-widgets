const { EVENTS } = require('../../config/constants');
const ActivityRoom = require('../../models/ActivityRoom');
const { validators } = require('../../utils/validation');
const { logger } = require('../../utils/logger');
const { createErrorResponse, createSuccessResponse, createRateLimitResponse } = require('../../utils/errors');
const { eventRateLimiter } = require('../../middleware/socketAuth');

/**
 * Handle activity-related socket events
 */
module.exports = function activityHandler(io, socket, sessionManager, getCurrentSessionCode) {

  // Activity update handler (host only)
  socket.on(EVENTS.ACTIVITY.UPDATE, (data) => {
    logger.debug('activity:update', 'Received activity update', {
      sessionCode: data.sessionCode,
      widgetId: data.widgetId
    });

    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) {
      logger.warn('activity:update', 'Ignoring activity:update - not from host');
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('activity:update', widgetValidation.error);
      return;
    }

    const room = session.getRoom('activity', data.widgetId);
    if (!room || !(room instanceof ActivityRoom)) {
      logger.warn('activity:update', 'Activity room not found', { widgetId: data.widgetId });
      return;
    }

    // Update activity
    if (data.activity) {
      if (data.activity.type && data.activity.items && data.activity.targets) {
        // Full activity update
        room.setActivity(data.activity);
      } else {
        // Partial update
        room.updateActivityData(data.activity);
      }
    }

    // Broadcast state update to all participants
    const roomId = `activity:${data.widgetId}`;
    const stateData = {
      widgetId: data.widgetId,
      activity: room.activity,
      isActive: room.isActive,
      actions: room.getActions(null),
      responseCount: room.getResponseCount()
    };

    logger.debug('activity:update', 'Broadcasting activity state', { roomId: `${session.code}:${roomId}` });
    io.to(`${session.code}:${roomId}`).emit(EVENTS.ACTIVITY.STATE_UPDATE, stateData);

    session.updateActivity();
  });

  // Activity reveal handler (host only)
  socket.on(EVENTS.ACTIVITY.REVEAL, (data) => {
    logger.debug('activity:reveal', 'Received reveal request', {
      sessionCode: data.sessionCode,
      widgetId: data.widgetId,
      reveal: data.reveal
    });

    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) {
      logger.warn('activity:reveal', 'Ignoring - not from host');
      return;
    }

    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('activity:reveal', widgetValidation.error);
      return;
    }

    const room = session.getRoom('activity', data.widgetId);
    if (!room || !(room instanceof ActivityRoom)) {
      logger.warn('activity:reveal', 'Activity room not found', { widgetId: data.widgetId });
      return;
    }

    room.revealAnswers(data.reveal);

    // Broadcast revealed answers to all participants
    const roomId = `activity:${data.widgetId}`;
    if (data.reveal) {
      io.to(`${session.code}:${roomId}`).emit(EVENTS.ACTIVITY.REVEALED, {
        widgetId: data.widgetId,
        correctAnswers: room.getCorrectAnswers()
      });
    }

    session.updateActivity();
  });

  // Activity reset handler (host only)
  socket.on(EVENTS.ACTIVITY.RESET, (data) => {
    logger.debug('activity:reset', 'Received reset request', {
      sessionCode: data.sessionCode,
      widgetId: data.widgetId
    });

    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) {
      logger.warn('activity:reset', 'Ignoring - not from host');
      return;
    }

    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('activity:reset', widgetValidation.error);
      return;
    }

    const room = session.getRoom('activity', data.widgetId);
    if (!room || !(room instanceof ActivityRoom)) {
      logger.warn('activity:reset', 'Activity room not found', { widgetId: data.widgetId });
      return;
    }

    room.reset();

    // Broadcast state update to all participants
    const roomId = `activity:${data.widgetId}`;
    const stateData = {
      widgetId: data.widgetId,
      activity: room.activity,
      isActive: room.isActive,
      actions: room.getActions(null),
      responseCount: 0
    };

    io.to(`${session.code}:${roomId}`).emit(EVENTS.ACTIVITY.STATE_UPDATE, stateData);

    session.updateActivity();
  });

  // Student requests activity state (on join/refresh)
  socket.on(EVENTS.ACTIVITY.REQUEST_STATE, (data) => {
    const { sessionCode, widgetId } = data;

    const sessionValidation = validators.sessionCode(sessionCode);
    if (!sessionValidation.valid) {
      logger.warn('activity:requestState', sessionValidation.error);
      return;
    }

    const widgetValidation = validators.widgetId(widgetId);
    if (!widgetValidation.valid) {
      logger.warn('activity:requestState', widgetValidation.error);
      return;
    }

    const session = sessionManager.getSession(sessionCode);

    if (session) {
      const room = session.getRoom('activity', widgetId);
      if (room && room instanceof ActivityRoom) {
        const stateData = room.getStateForStudent(socket.id);
        stateData.widgetId = widgetId;
        stateData.responseCount = room.getResponseCount();

        socket.emit(EVENTS.ACTIVITY.STATE_UPDATE, stateData);

        // Also emit the widget's active state
        socket.emit(EVENTS.SESSION.WIDGET_STATE_CHANGED, {
          roomType: 'activity',
          widgetId: widgetId,
          isActive: room.isActive
        });
      }
    }
  });

  // Student submits activity answer
  socket.on(EVENTS.ACTIVITY.SUBMIT, (data, callback) => {
    const { sessionCode, widgetId, answers } = data;

    logger.debug('activity:submit', 'Received submission', {
      sessionCode,
      widgetId,
      socketId: socket.id
    });

    // Rate limit
    const rateLimitResult = eventRateLimiter(socket, EVENTS.ACTIVITY.SUBMIT);
    if (!rateLimitResult.allowed) {
      if (callback) {
        callback({
          ...createRateLimitResponse(rateLimitResult.retryAfter),
          widgetId
        });
      }
      return;
    }

    const session = sessionManager.getSession(sessionCode || getCurrentSessionCode());

    if (!session) {
      logger.warn('activity:submit', 'Session not found', { sessionCode });
      if (callback) {
        callback({
          ...createErrorResponse('INVALID_SESSION'),
          widgetId
        });
      }
      return;
    }

    const room = session.getRoom('activity', widgetId);
    if (!room || !(room instanceof ActivityRoom)) {
      logger.warn('activity:submit', 'Activity room not found', { widgetId });
      if (callback) {
        callback({
          ...createErrorResponse('ROOM_NOT_FOUND'),
          widgetId
        });
      }
      return;
    }

    // Check if activity is active
    if (!room.isActive) {
      logger.debug('activity:submit', 'Activity is not active', { widgetId });
      if (callback) {
        callback({
          ...createErrorResponse('WIDGET_PAUSED'),
          widgetId
        });
      }
      return;
    }

    // Check if participant exists
    const participant = session.getParticipant(socket.id);
    if (!participant) {
      logger.warn('activity:submit', 'Participant not found', { socketId: socket.id });
      if (callback) {
        callback({
          ...createErrorResponse('NOT_PARTICIPANT'),
          widgetId
        });
      }
      return;
    }

    // Submit the answer
    const result = room.submitAnswer(socket.id, answers);

    if (result.success) {
      logger.debug('activity:submit', 'Submission recorded', {
        socketId: socket.id,
        score: result.results.score,
        total: result.results.total
      });

      // Send callback to student
      if (callback) {
        callback(createSuccessResponse({
          widgetId,
          results: result.showFeedback ? result.results : null
        }));
      }

      // Send feedback to student if enabled
      if (result.showFeedback) {
        socket.emit(EVENTS.ACTIVITY.FEEDBACK, {
          widgetId,
          results: result.results,
          actions: room.getActions(socket.id)
        });
      }

      // Notify teacher of new response
      if (session.hostSocketId) {
        io.to(session.hostSocketId).emit(EVENTS.ACTIVITY.RESPONSE_RECEIVED, {
          widgetId,
          studentId: socket.id,
          studentName: participant.name,
          response: answers,
          results: result.results
        });
      }
    } else {
      if (callback) {
        callback({
          ...createErrorResponse('SUBMISSION_FAILED', result.error),
          widgetId
        });
      }
    }

    session.updateActivity();
  });
};
