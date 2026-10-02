const { EVENTS, LIMITS } = require('../../config/constants');
const RTFeedbackRoom = require('../../models/RTFeedbackRoom');
const { validators } = require('../../utils/validation');
const { logger } = require('../../utils/logger');
const { createErrorResponse, createSuccessResponse, createRateLimitResponse, ERROR_CODES } = require('../../utils/errors');
const { eventRateLimiter } = require('../../middleware/socketAuth');
const { resolveRoom, resolveHostRoom, isHostRejection } = require('./resolveHostRoom');

/**
 * Handle real-time feedback related socket events
 */
module.exports = function rtFeedbackHandler(io, socket, sessionManager, getCurrentSessionCode) {

  // Handle student feedback submission
  socket.on(EVENTS.RT_FEEDBACK.SUBMIT, (data) => {
    // Check rate limit
    const rateLimitResult = eventRateLimiter(socket, EVENTS.RT_FEEDBACK.SUBMIT);
    if (!rateLimitResult.allowed) {
      socket.emit(EVENTS.RT_FEEDBACK.SUBMITTED, createRateLimitResponse(rateLimitResult.retryAfter));
      return;
    }

    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session) {
      socket.emit(EVENTS.RT_FEEDBACK.SUBMITTED, createErrorResponse('INVALID_SESSION'));
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      socket.emit(EVENTS.RT_FEEDBACK.SUBMITTED, createErrorResponse('INVALID_INPUT', widgetValidation.error));
      return;
    }

    const guard = resolveRoom(session, 'rtfeedback', RTFeedbackRoom, data.widgetId);
    if (!guard.ok) {
      socket.emit(EVENTS.RT_FEEDBACK.SUBMITTED, createErrorResponse('ROOM_NOT_FOUND'));
      return;
    }
    const { room } = guard;

    // Check if feedback is active
    if (!room.isActive) {
      socket.emit(EVENTS.RT_FEEDBACK.SUBMITTED, createErrorResponse('WIDGET_PAUSED'));
      return;
    }

    // Validate feedback value (1-5 scale)
    const valueValidation = validators.feedbackValue(data.value);
    if (!valueValidation.valid) {
      socket.emit(EVENTS.RT_FEEDBACK.SUBMITTED, createErrorResponse('INVALID_INPUT', valueValidation.error));
      return;
    }

    // Check if student is a participant
    const participant = session.participants.get(socket.id);
    if (!participant) {
      socket.emit(EVENTS.RT_FEEDBACK.SUBMITTED, createErrorResponse('NOT_PARTICIPANT'));
      return;
    }

    // Submit feedback
    room.updateFeedback(socket.id, data.value);

    // Send confirmation
    socket.emit(EVENTS.RT_FEEDBACK.SUBMITTED, createSuccessResponse());

    // Only the teacher consumes the aggregate; students receive confirmations.
    if (session.hostSocketId) {
      io.to(session.hostSocketId).emit(EVENTS.RT_FEEDBACK.DATA_UPDATE, {
        ...room.getAggregatedFeedback(),
        widgetId: data.widgetId
      });
    }

    session.updateActivity();
  });

  // Student requests rtfeedback state (on join/refresh)
  socket.on(EVENTS.RT_FEEDBACK.REQUEST_STATE, (data) => {
    const { sessionCode, widgetId } = data;

    // Validate input
    const sessionValidation = validators.sessionCode(sessionCode);
    if (!sessionValidation.valid) {
      logger.warn('rtfeedback:requestState', sessionValidation.error);
      return;
    }

    const widgetValidation = validators.widgetId(widgetId);
    if (!widgetValidation.valid) {
      logger.warn('rtfeedback:requestState', widgetValidation.error);
      return;
    }

    const session = sessionManager.getSession(sessionCode);

    const { ok, room } = resolveRoom(session, 'rtfeedback', RTFeedbackRoom, widgetId);
    if (ok) {
      const stateData = {
        isActive: room.isActive,
        widgetId: widgetId
      };

      socket.emit(EVENTS.RT_FEEDBACK.STATE_UPDATE, stateData);
    }
  });

  // Handle reset request (host only)
  socket.on(EVENTS.RT_FEEDBACK.RESET, (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());

    const guard = resolveHostRoom(session, socket, 'rtfeedback', RTFeedbackRoom, data.widgetId);
    if (isHostRejection(guard.error)) {
      logger.warn('rtfeedback:reset', 'Unauthorized reset attempt');
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('rtfeedback:reset', widgetValidation.error);
      return;
    }

    if (!guard.ok) {
      logger.warn('rtfeedback:reset', 'Room not found', { widgetId: data.widgetId });
      return;
    }
    const { room } = guard;

    room.clearAllFeedback();

    // The reset caller is the authorized host.
    socket.emit(EVENTS.RT_FEEDBACK.DATA_UPDATE, {
      ...room.getAggregatedFeedback(),
      widgetId: data.widgetId
    });

    session.updateActivity();
  });

};
