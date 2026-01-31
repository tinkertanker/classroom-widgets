const { EVENTS, LIMITS } = require('../../config/constants');
const LinkShareRoom = require('../../models/LinkShareRoom');
const { validators } = require('../../utils/validation');
const { logger } = require('../../utils/logger');
const { createErrorResponse, createSuccessResponse, createRateLimitResponse, ERROR_CODES } = require('../../utils/errors');
const { eventRateLimiter } = require('../../middleware/socketAuth');

/**
 * Handle link share related socket events
 */
module.exports = function linkShareHandler(io, socket, sessionManager, getCurrentSessionCode) {

  // Handle link submission
  socket.on(EVENTS.LINK_SHARE.SUBMIT, (data) => {
    // Check rate limit
    const rateLimitResult = eventRateLimiter(socket, EVENTS.LINK_SHARE.SUBMIT);
    if (!rateLimitResult.allowed) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createRateLimitResponse(rateLimitResult.retryAfter));
      return;
    }

    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('INVALID_SESSION'));
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('INVALID_INPUT', widgetValidation.error));
      return;
    }

    const room = session.getRoom('linkShare', data.widgetId);
    if (!room || !(room instanceof LinkShareRoom)) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('ROOM_NOT_FOUND'));
      return;
    }

    const participant = session.participants.get(socket.id);
    if (!participant) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('NOT_PARTICIPANT'));
      return;
    }

    // Check if link sharing is active
    if (!room.isActive) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('WIDGET_PAUSED'));
      return;
    }

    // Validate link URL
    const linkValidation = validators.link(data.link);
    if (!linkValidation.valid) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('INVALID_INPUT', linkValidation.error));
      return;
    }

    // Validate student name if provided
    const studentName = data.studentName || participant.name;
    if (data.studentName) {
      const nameValidation = validators.studentName(data.studentName);
      if (!nameValidation.valid) {
        socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('INVALID_INPUT', nameValidation.error));
        return;
      }
    }

    // Update participant name if provided
    if (data.studentName && data.studentName !== participant.name) {
      participant.name = data.studentName;
    }

    const submission = room.addSubmission(studentName, data.link);

    // Notify all in the room - emit both new and legacy events
    const linkShareRoomId = data.widgetId ? `linkShare:${data.widgetId}` : 'linkShare';
    const submissionData = {
      ...submission,
      widgetId: data.widgetId
    };

    io.to(`${session.code}:${linkShareRoomId}`).emit(EVENTS.LINK_SHARE.SUBMISSION_ADDED, submissionData);
    io.to(`${session.code}:${linkShareRoomId}`).emit(EVENTS.LINK_SHARE.NEW_SUBMISSION, submissionData); // Legacy

    // Send confirmation to submitter
    socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createSuccessResponse());

    session.updateActivity();
  });

  // Handle submission deletion (host only)
  socket.on(EVENTS.LINK_SHARE.DELETE, (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());
    if (!session || session.hostSocketId !== socket.id) {
      logger.warn('linkShare:delete', 'Unauthorized delete attempt');
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('linkShare:delete', widgetValidation.error);
      return;
    }

    const room = session.getRoom('linkShare', data.widgetId);
    if (!room || !(room instanceof LinkShareRoom)) {
      logger.warn('linkShare:delete', 'Room not found', { widgetId: data.widgetId });
      return;
    }

    if (room.deleteSubmission(data.submissionId)) {
      const linkShareRoomId = data.widgetId ? `linkShare:${data.widgetId}` : 'linkShare';
      io.to(`${session.code}:${linkShareRoomId}`).emit(EVENTS.LINK_SHARE.SUBMISSION_DELETED, {
        submissionId: data.submissionId,
        widgetId: data.widgetId
      });
    }

    session.updateActivity();
  });

  // Student requests linkShare state (on join/refresh)
  socket.on(EVENTS.LINK_SHARE.REQUEST_STATE, (data) => {
    // Support both 'sessionCode' (new) and 'code' (legacy)
    const sessionCode = data.sessionCode || data.code;
    const { widgetId } = data;

    // Validate input
    const sessionValidation = validators.sessionCode(sessionCode);
    if (!sessionValidation.valid) {
      logger.warn('linkShare:requestState', sessionValidation.error);
      return;
    }

    const widgetValidation = validators.widgetId(widgetId);
    if (!widgetValidation.valid) {
      logger.warn('linkShare:requestState', widgetValidation.error);
      return;
    }

    const session = sessionManager.getSession(sessionCode);

    if (session) {
      const room = session.getRoom('linkShare', widgetId);
      if (room && room instanceof LinkShareRoom) {
        const stateData = {
          isActive: room.isActive,
          widgetId: widgetId
        };

        // Emit both new and legacy events
        socket.emit(EVENTS.LINK_SHARE.STATE_UPDATE, stateData);
        socket.emit(EVENTS.LINK_SHARE.STATE_CHANGED, stateData); // Legacy
      }
    }
  });

};
