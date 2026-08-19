/**
 * Shared host/room resolution guard for the widget socket handlers.
 *
 * Before acting on a room, every widget handler repeats the same checks: the
 * session must exist, host-only events additionally require the socket to be
 * that session's host, and the room must exist and be of the expected type.
 * This module runs those checks and hands back the room together with the
 * internal room key that `Session` already builds for its own lookups, so
 * handlers stop hand-rolling `roomType:widgetId` strings.
 *
 * It deliberately never logs and never emits. Each handler keeps its own
 * rejection shape - some warn and return silently, others answer over a
 * callback or a socket event - and maps the returned `error` onto that shape.
 *
 * The result is a plain value, so a handler may consult the host rejection at
 * one point and the room result at another. Host-only handlers do exactly
 * that: they reject non-hosts first, then validate the widget ID, then act on
 * the resolved room - the order they checked in before this helper existed.
 */

/**
 * Reasons a room could not be resolved.
 * @readonly
 */
const GUARD_ERRORS = Object.freeze({
  NO_SESSION: 'NO_SESSION',
  NOT_HOST: 'NOT_HOST',
  NO_ROOM: 'NO_ROOM',
  WRONG_ROOM_TYPE: 'WRONG_ROOM_TYPE'
});

/**
 * @typedef {Object} RoomResolution
 * @property {boolean} ok - Whether the room was resolved
 * @property {Object|null} room - The resolved room instance, or null
 * @property {string|null} roomId - Internal room key (`roomType` or `roomType:widgetId`)
 * @property {string|null} error - One of GUARD_ERRORS when `ok` is false
 */

/**
 * @param {string} error
 * @returns {RoomResolution}
 */
function reject(error) {
  return { ok: false, room: null, roomId: null, error };
}

/**
 * True when a rejection means "this socket is not the host of a live session",
 * i.e. the condition handlers previously spelled as
 * `!session || session.hostSocketId !== socket.id`.
 *
 * @param {string|null|undefined} error
 * @returns {boolean}
 */
function isHostRejection(error) {
  return error === GUARD_ERRORS.NO_SESSION || error === GUARD_ERRORS.NOT_HOST;
}

/**
 * Resolve a room within a session, without any host requirement.
 *
 * @param {Object|null|undefined} session - Session instance, if one was found
 * @param {string} roomType - Room type key, e.g. 'poll'
 * @param {Function} RoomClass - Expected room constructor, e.g. PollRoom
 * @param {string} [widgetId] - Widget ID scoping the room
 * @returns {RoomResolution}
 */
function resolveRoom(session, roomType, RoomClass, widgetId) {
  if (!session) {
    return reject(GUARD_ERRORS.NO_SESSION);
  }

  const room = session.getRoom(roomType, widgetId);
  if (!room) {
    return reject(GUARD_ERRORS.NO_ROOM);
  }
  if (!(room instanceof RoomClass)) {
    return reject(GUARD_ERRORS.WRONG_ROOM_TYPE);
  }

  // Session already knows how to build its own room key; reuse it rather than
  // rebuilding `roomType:widgetId` at every broadcast site.
  return { ok: true, room, roomId: session._roomKey(roomType, widgetId), error: null };
}

/**
 * Resolve a room within a session, requiring the socket to be the host.
 *
 * @param {Object|null|undefined} session - Session instance, if one was found
 * @param {{id: string}} socket - The socket that sent the event
 * @param {string} roomType - Room type key, e.g. 'poll'
 * @param {Function} RoomClass - Expected room constructor, e.g. PollRoom
 * @param {string} [widgetId] - Widget ID scoping the room
 * @returns {RoomResolution}
 */
function resolveHostRoom(session, socket, roomType, RoomClass, widgetId) {
  if (!session) {
    return reject(GUARD_ERRORS.NO_SESSION);
  }
  if (!session.isHost(socket.id)) {
    return reject(GUARD_ERRORS.NOT_HOST);
  }

  return resolveRoom(session, roomType, RoomClass, widgetId);
}

module.exports = { GUARD_ERRORS, isHostRejection, resolveRoom, resolveHostRoom };
