const { logger } = require('../utils/logger');
const { createErrorResponse } = require('../utils/errors');

/**
 * Wrap socket.on so a throwing event handler cannot crash the server
 * process. Socket event payloads are client-controlled; without this, a
 * single malformed payload that slips past a handler's validation would
 * surface as an uncaught exception (or unhandled rejection, for async
 * handlers) and take down every session.
 *
 * If the client supplied an acknowledgement callback, it receives a
 * standardized INTERNAL_ERROR response instead of silence.
 */
function installSafeSocketEvents(socket) {
  const rawOn = socket.on.bind(socket);

  socket.on = (event, handler) => rawOn(event, (...args) => {
    const handleError = (error) => {
      logger.error(`Unhandled error in '${event}' socket handler`, {
        socketId: socket.id,
        message: error && error.message,
        stack: error && error.stack
      });

      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        try {
          callback(createErrorResponse('INTERNAL_ERROR'));
        } catch {
          // Ack already consumed or client gone - nothing more to do.
        }
      }
    };

    try {
      const result = handler(...args);
      // Async handlers reject instead of throwing synchronously.
      if (result && typeof result.then === 'function') {
        return result.then(undefined, handleError);
      }
      return result;
    } catch (error) {
      handleError(error);
    }
  });

  return socket;
}

module.exports = { installSafeSocketEvents };
