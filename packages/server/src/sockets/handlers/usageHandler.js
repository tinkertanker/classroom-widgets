const { eventRateLimiter } = require('../../middleware/socketAuth');
const { usageLog, normaliseClientEvent } = require('../../services/usageLog');

/**
 * Teacher app usage events (app opened, widget added) for the admin usage
 * dashboard. Fire-and-forget: no acknowledgement, and malformed or
 * rate-limited events are dropped silently.
 */
module.exports = function usageHandler(io, socket) {
  socket.on('usage:track', (data) => {
    if (!eventRateLimiter(socket, 'usage:track').allowed) return;
    const event = normaliseClientEvent(data);
    if (!event) return;
    // Marks this connection as an open teacher app for the live figures,
    // which are kept even when the log itself is off.
    if (event.e === 'app_open') socket.data.usageClientId = event.c;
    usageLog.record(event);
  });
};
