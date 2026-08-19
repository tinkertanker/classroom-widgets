const { EVENTS } = require('../../config/constants');
const HandoutRoom = require('../../models/HandoutRoom');
const { validators } = require('../../utils/validation');
const { logger } = require('../../utils/logger');
const { resolveRoom, resolveHostRoom, isHostRejection } = require('./resolveHostRoom');

/**
 * Handle handout related socket events
 */
module.exports = function handoutHandler(io, socket, sessionManager, getCurrentSessionCode) {

  // Host adds item to handout
  socket.on(EVENTS.HANDOUT.ADD, (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());

    const guard = resolveHostRoom(session, socket, 'handout', HandoutRoom, data.widgetId);
    if (isHostRejection(guard.error)) {
      logger.warn('handout:add', 'Unauthorized add attempt');
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('handout:add', widgetValidation.error);
      return;
    }

    if (!guard.ok) {
      logger.warn('handout:add', 'Room not found', { widgetId: data.widgetId });
      return;
    }
    const { room, roomId: handoutRoomId } = guard;

    // Validate content
    if (!data.content || typeof data.content !== 'string') {
      logger.warn('handout:add', 'Invalid content');
      return;
    }

    const content = data.content.trim();
    if (content.length === 0 || content.length > 2000) {
      logger.warn('handout:add', 'Content length invalid');
      return;
    }

    // Normalize URL if it looks like a link
    const normalizedContent = validators.normalizeUrl(content);
    const isLink = validators.isLink(normalizedContent);

    // Add item
    const item = room.addItem(normalizedContent, isLink);

    // Broadcast to all in the room
    io.to(`${session.code}:${handoutRoomId}`).emit(EVENTS.HANDOUT.ITEM_ADDED, {
      ...item,
      widgetId: data.widgetId
    });

    session.updateActivity();
  });

  // Host deletes item from handout
  socket.on(EVENTS.HANDOUT.DELETE, (data) => {
    const session = sessionManager.getSession(data.sessionCode || getCurrentSessionCode());

    const guard = resolveHostRoom(session, socket, 'handout', HandoutRoom, data.widgetId);
    if (isHostRejection(guard.error)) {
      logger.warn('handout:delete', 'Unauthorized delete attempt');
      return;
    }

    // Validate widget ID
    const widgetValidation = validators.widgetId(data.widgetId);
    if (!widgetValidation.valid) {
      logger.warn('handout:delete', widgetValidation.error);
      return;
    }

    if (!guard.ok) {
      logger.warn('handout:delete', 'Room not found', { widgetId: data.widgetId });
      return;
    }
    const { room, roomId: handoutRoomId } = guard;

    if (room.deleteItem(data.itemId)) {
      io.to(`${session.code}:${handoutRoomId}`).emit(EVENTS.HANDOUT.ITEM_DELETED, {
        itemId: data.itemId,
        widgetId: data.widgetId
      });
    }

    session.updateActivity();
  });

  // Student requests handout state (on join/refresh)
  socket.on(EVENTS.HANDOUT.REQUEST_STATE, (data) => {
    const { sessionCode, widgetId } = data;

    // Validate input
    const sessionValidation = validators.sessionCode(sessionCode);
    if (!sessionValidation.valid) {
      logger.warn('handout:requestState', sessionValidation.error);
      return;
    }

    const widgetValidation = validators.widgetId(widgetId);
    if (!widgetValidation.valid) {
      logger.warn('handout:requestState', widgetValidation.error);
      return;
    }

    const session = sessionManager.getSession(sessionCode);

    const { ok, room } = resolveRoom(session, 'handout', HandoutRoom, widgetId);
    if (ok) {
      socket.emit(EVENTS.HANDOUT.STATE_UPDATE, {
        items: room.getItems(),
        isActive: room.isActive,
        widgetId: widgetId
      });
    }
  });

};
