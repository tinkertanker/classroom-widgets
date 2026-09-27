/**
 * Close a widget room and tell everyone in the session: the teacher's widget
 * and the students' cards both listen for session:roomClosed. Then take every
 * socket out of the room's broadcast channel.
 *
 * Used for a teacher closing or deleting a widget, for the post-recovery
 * orphan cleanup, and for idle-room expiry.
 *
 * @returns {boolean} Whether a room was actually removed
 */
function closeRoomAndNotify(io, session, roomType, widgetId) {
  const roomNamespace = `${session.code}:${session._roomKey(roomType, widgetId)}`;
  const closed = session.closeRoom(roomType, widgetId);

  io.to(`session:${session.code}`).emit('session:roomClosed', { roomType, widgetId });

  const socketsInRoom = io.sockets.adapter.rooms.get(roomNamespace);
  if (socketsInRoom) {
    socketsInRoom.forEach(socketId => {
      const s = io.sockets.sockets.get(socketId);
      if (s) s.leave(roomNamespace);
    });
  }
  return closed;
}

module.exports = { closeRoomAndNotify };
