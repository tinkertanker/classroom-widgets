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
 * It deliberately never logs and never emits. A resolved room is marked as
 * active, which is what keeps it from idle expiry. Each handler keeps its own
 * rejection shape - some warn and return silently, others answer over a
 * callback or a socket event - and maps the returned `error` onto that shape.
 *
 * The result is a plain value, so a handler may consult the host rejection at
 * one point and the room result at another. Host-only handlers do exactly
 * that: they reject non-hosts first, then validate the widget ID, then act on
 * the resolved room - the order they checked in before this helper existed.
 */

const { eventRateLimiter, JOIN_MISS_EVENT, STATE_READ_EVENT } = require('../../middleware/socketAuth');

/**
 * Reasons a room could not be resolved.
 * @readonly
 */
const GUARD_ERRORS = Object.freeze({
  NO_SESSION: 'NO_SESSION',
  NOT_HOST: 'NOT_HOST',
  NO_ROOM: 'NO_ROOM',
  WRONG_ROOM_TYPE: 'WRONG_ROOM_TYPE',
  NOT_MEMBER: 'NOT_MEMBER',
  RATE_LIMITED: 'RATE_LIMITED'
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

  // Every host or student event on a room goes through here, so this is the
  // one place that keeps a room in use from being expired as idle.
  room.updateActivity();

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

/**
 * True when the socket joined this session as a student. The session a socket
 * joined is recorded only by session:join, and a socket can be in one session
 * at a time, so a student of another session is never a member here.
 *
 * @param {Object|null|undefined} session
 * @param {{id: string, data?: Object}} socket
 * @returns {boolean}
 */
function isParticipant(session, socket) {
  return Boolean(session)
    && socket.data?.sessionCode === session.code
    && Boolean(session.getParticipant(socket.id));
}

/**
 * The session a student submit is for, or null when the socket did not join
 * it (finding 9).
 *
 * Every refusal looks the same to the client, so a submit cannot be used to
 * tell a live session code from an unknown one. A submit naming a code with no
 * session draws on the same per-IP budget as a failed session:join, so code
 * guessing through submits also runs out. Submits to a live session from a
 * socket that is not (yet) in it are not counted: a reconnecting student's
 * buffered submit can arrive before its rejoin, and every student behind a
 * school's single address shares that budget.
 *
 * @param {Object} sessionManager
 * @param {Object} socket
 * @param {*} requestedCode - `sessionCode` from the payload, if any
 * @param {Function} getCurrentSessionCode
 * @returns {Object|null}
 */
function resolveParticipantSession(sessionManager, socket, requestedCode, getCurrentSessionCode) {
  const code = requestedCode || getCurrentSessionCode();
  const session = typeof code === 'string' ? sessionManager.getSession(code) : undefined;
  if (isParticipant(session, socket)) return session;
  if (!session) eventRateLimiter(socket, JOIN_MISS_EVENT);
  return null;
}

/**
 * Resolve a room for a `<roomType>:requestState` read (#231).
 *
 * Only the session's host and its joined students may read. Everyone else is
 * refused before the room is touched, so an outsider's read never refreshes
 * the room's idle timer. Reads are then budgeted per socket and per room
 * (STATE_READ_EVENT): the budget is only spent on rooms that exist, so a
 * reader cannot grow the limiter with made-up widget IDs.
 *
 * @param {Object} sessionManager
 * @param {Object} socket
 * @param {string} sessionCode - Already validated by the caller
 * @param {string} roomType
 * @param {Function} RoomClass
 * @param {string} widgetId - Already validated by the caller
 * @returns {RoomResolution}
 */
function resolveReadableRoom(sessionManager, socket, sessionCode, roomType, RoomClass, widgetId) {
  const session = sessionManager.getSession(sessionCode);
  if (!session) {
    return reject(GUARD_ERRORS.NO_SESSION);
  }
  if (!session.isHost(socket.id) && !isParticipant(session, socket)) {
    return reject(GUARD_ERRORS.NOT_MEMBER);
  }
  if (!session.getRoom(roomType, widgetId)) {
    return reject(GUARD_ERRORS.NO_ROOM);
  }
  const budget = eventRateLimiter(socket, STATE_READ_EVENT, { subKey: session._roomKey(roomType, widgetId) });
  if (!budget.allowed) {
    return reject(GUARD_ERRORS.RATE_LIMITED);
  }
  return resolveRoom(session, roomType, RoomClass, widgetId);
}

module.exports = {
  GUARD_ERRORS,
  isHostRejection,
  isParticipant,
  resolveRoom,
  resolveHostRoom,
  resolveParticipantSession,
  resolveReadableRoom
};
