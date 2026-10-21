const { EVENTS } = require('../../config/constants');
const LinkShareRoom = require('../../models/LinkShareRoom');
const { validators } = require('../../utils/validation');
const { logger } = require('../../utils/logger');
const { createErrorResponse, createSuccessResponse, createRateLimitResponse } = require('../../utils/errors');
const { eventRateLimiter } = require('../../middleware/socketAuth');
const { resolveRoom, resolveHostRoom, isHostRejection, resolveParticipantSession, resolveReadableRoom } = require('./resolveHostRoom');

/**
 * Handle link share related socket events
 */
module.exports = function linkShareHandler(io, socket, sessionManager, getCurrentSessionCode) {

  // Handle link/text submission
  socket.on(EVENTS.LINK_SHARE.SUBMIT, (data) => {
    // Check rate limit
    const rateLimitResult = eventRateLimiter(socket, EVENTS.LINK_SHARE.SUBMIT);
    if (!rateLimitResult.allowed) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createRateLimitResponse(rateLimitResult.retryAfter));
      return;
    }

    // Only a student who joined this session may submit (finding 9)
    const session = resolveParticipantSession(sessionManager, socket, data.sessionCode, getCurrentSessionCode);
    if (!session) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('NOT_PARTICIPANT'));
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('INVALID_INPUT', widgetValidation.error));
      return;
    }

    const guard = resolveRoom(session, 'linkShare', LinkShareRoom, data.widgetId);
    if (!guard.ok) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('ROOM_NOT_FOUND'));
      return;
    }
    const { room } = guard;

    const participant = session.getParticipant(socket.id);

    // Check if submissions are active
    if (!room.isActive) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('WIDGET_PAUSED'));
      return;
    }

    // Get content - support both 'link' (legacy) and 'content' fields
    const rawContent = data.content || data.link;
    if (!rawContent) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('INVALID_INPUT', 'Content is required'));
      return;
    }

    // Normalize URL (add https:// if it looks like a domain without protocol)
    const content = validators.normalizeUrl(rawContent, room.acceptMode);

    // Check if it's a link
    const isLink = validators.isLink(content, room.acceptMode);

    // Validate based on room accept mode
    if (room.acceptMode === 'links') {
      // Links only mode - must be valid URL
      const linkValidation = validators.link(content);
      if (!linkValidation.valid) {
        socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('INVALID_INPUT', linkValidation.error));
        return;
      }
    } else {
      // All mode - accept links or text (max 280 chars)
      if (isLink) {
        const linkValidation = validators.link(content);
        if (!linkValidation.valid) {
          socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('INVALID_INPUT', linkValidation.error));
          return;
        }
      } else {
        const textValidation = validators.textSubmission(content);
        if (!textValidation.valid) {
          socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('INVALID_INPUT', textValidation.error));
          return;
        }
      }
    }

    // Validate student name if provided
    if (data.studentName) {
      const nameValidation = validators.studentName(data.studentName);
      if (!nameValidation.valid) {
        socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('INVALID_INPUT', nameValidation.error));
        return;
      }
    }
    // Trimmed, as the validator measured it: padding cannot oversize the name.
    const studentName = data.studentName ? data.studentName.trim() : participant.name;

    // Update participant name if provided
    if (data.studentName && studentName !== participant.name) {
      participant.name = studentName;
    }

    const submission = room.addSubmission(studentName, content, isLink);

    if (!submission) {
      socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createErrorResponse('ROOM_FULL'));
      return;
    }

    // Submissions are for the teacher only (see LinkShareRoom#toStudentJSON):
    // classmates in the room must not receive each other's work and names.
    if (session.hostSocketId) {
      io.to(session.hostSocketId).emit(EVENTS.LINK_SHARE.SUBMISSION_ADDED, {
        ...submission,
        widgetId: data.widgetId
      });
    }

    // Send confirmation to submitter
    socket.emit(EVENTS.LINK_SHARE.SUBMITTED, createSuccessResponse());

    session.updateActivity();
  });

  // Handle submission deletion (host only)
  socket.on(EVENTS.LINK_SHARE.DELETE, (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());

    const guard = resolveHostRoom(session, socket, 'linkShare', LinkShareRoom, data.widgetId);
    if (isHostRejection(guard.error)) {
      logger.warn('linkShare:delete', 'Unauthorized delete attempt');
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('linkShare:delete', widgetValidation.error);
      return;
    }

    if (!guard.ok) {
      logger.warn('linkShare:delete', 'Room not found', { widgetId: data.widgetId });
      return;
    }
    const { room, roomId: linkShareRoomId } = guard;

    if (room.deleteSubmission(data.submissionId)) {
      io.to(`${session.code}:${linkShareRoomId}`).emit(EVENTS.LINK_SHARE.SUBMISSION_DELETED, {
        submissionId: data.submissionId,
        widgetId: data.widgetId
      });
    }

    session.updateActivity();
  });

  // Student requests linkShare state (on join/refresh)
  socket.on(EVENTS.LINK_SHARE.REQUEST_STATE, (data) => {
    const { sessionCode, widgetId } = data;

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

    const { ok, room } = resolveReadableRoom(sessionManager, socket, sessionCode, 'linkShare', LinkShareRoom, widgetId);
    if (ok) {
      socket.emit(EVENTS.LINK_SHARE.STATE_UPDATE, {
        isActive: room.isActive,
        acceptMode: room.acceptMode,
        widgetId: widgetId
      });
    }
  });

  // Handle accept mode change (host only)
  socket.on(EVENTS.LINK_SHARE.SET_ACCEPT_MODE, (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());

    const guard = resolveHostRoom(session, socket, 'linkShare', LinkShareRoom, data.widgetId);
    if (isHostRejection(guard.error)) {
      logger.warn('linkShare:setAcceptMode', 'Unauthorized attempt');
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('linkShare:setAcceptMode', widgetValidation.error);
      return;
    }

    if (!guard.ok) {
      logger.warn('linkShare:setAcceptMode', 'Room not found', { widgetId: data.widgetId });
      return;
    }
    const { room, roomId: linkShareRoomId } = guard;

    // Validate accept mode
    if (data.acceptMode !== 'links' && data.acceptMode !== 'all') {
      logger.warn('linkShare:setAcceptMode', 'Invalid accept mode', { acceptMode: data.acceptMode });
      return;
    }

    room.setAcceptMode(data.acceptMode);

    // Notify all in the room about the mode change
    io.to(`${session.code}:${linkShareRoomId}`).emit(EVENTS.LINK_SHARE.STATE_UPDATE, {
      isActive: room.isActive,
      acceptMode: room.acceptMode,
      widgetId: data.widgetId
    });

    session.updateActivity();
  });

};
