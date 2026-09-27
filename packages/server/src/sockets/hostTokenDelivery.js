const { TIME } = require('../config/constants');

/**
 * Confirm that a teacher received the host token rotated by a reclaim, so the
 * token it presented can stop working (see Session.reclaimHost).
 *
 * Engine.io answers heartbeats in order: a pong to a ping sent after the reply
 * means the client's socket received the reply. The client may still drop it
 * (an older teacher app ignores a reply that lands during a reconnect), and
 * then it disconnects straight away. So delivery counts as confirmed once the
 * socket has answered that ping and stayed connected HOST_TOKEN_CONFIRM_DELAY.
 * A host event from the socket confirms it sooner (Session.isHost).
 */

const PENDING_PINGS = Symbol('pendingPings');

/**
 * Count heartbeats awaiting a pong on this socket. Call once per connection.
 */
function trackHeartbeats(socket) {
  const conn = socket.conn;
  if (!conn || typeof conn.on !== 'function') return;
  conn[PENDING_PINGS] = 0;
  conn.on('packetCreate', (packet) => {
    if (packet.type === 'ping') conn[PENDING_PINGS]++;
  });
  conn.on('packet', (packet) => {
    if (packet.type === 'pong' && conn[PENDING_PINGS] > 0) conn[PENDING_PINGS]--;
  });
}

/**
 * After a reclaim reply has been sent on `socket`, retire the session's
 * previous host token once delivery is confirmed. Without a heartbeat-capable
 * transport, the session's PREVIOUS_HOST_TOKEN_MAX_AGE backstop applies.
 */
function confirmHostTokenDelivery(session, socket) {
  const conn = socket.conn;
  if (!conn || typeof conn.sendPacket !== 'function' || typeof conn[PENDING_PINGS] !== 'number') return;

  // Pings sent before the reply are answered first; their pongs prove nothing
  let pongsToSkip = conn[PENDING_PINGS];
  let timer = null;
  const stop = () => {
    conn.off('packet', onPacket);
    conn.off('close', stop);
    if (timer) clearTimeout(timer);
  };
  const onPacket = (packet) => {
    if (packet.type !== 'pong') return;
    if (pongsToSkip > 0) {
      pongsToSkip--;
      return;
    }
    conn.off('packet', onPacket);
    timer = setTimeout(() => {
      conn.off('close', stop);
      if (session.hostSocketId === socket.id) session.retirePreviousHostToken();
    }, TIME.HOST_TOKEN_CONFIRM_DELAY);
    if (timer.unref) timer.unref();
  };
  conn.on('packet', onPacket);
  conn.on('close', stop);
  // Ask now rather than wait up to a ping interval for the next heartbeat
  conn.sendPacket('ping');
}

module.exports = { trackHeartbeats, confirmHostTokenDelivery };
