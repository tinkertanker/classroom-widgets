const { eventRateLimiter } = require('../../middleware/socketAuth');
const { usageLog, normaliseClientEvent } = require('../../services/usageLog');

/**
 * Teacher app usage events (app opened, widget added) for the admin usage
 * dashboard. Fire-and-forget: no acknowledgement, and malformed or
 * rate-limited events are dropped silently.
 */
module.exports = function usageHandler(io, socket) {
  socket.on('usage:track', (data) => {
    if (!usageLog.enabled) return;
    if (!eventRateLimiter(socket, 'usage:track').allowed) return;
    const event = normaliseClientEvent(data);
    if (event) usageLog.record(event);
  });
};
