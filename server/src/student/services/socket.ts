import { io, Socket } from 'socket.io-client';

// Simple socket factory - creates new socket instances with reconnection support
// This maintains the original behavior where each session gets its own socket
export const getSocket = (): Socket => {
  return io({
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  });
};

// Optional: Add a cleanup function for completeness
export const disconnectSocket = (socket: Socket): void => {
  if (socket) {
    socket.disconnect();
  }
};