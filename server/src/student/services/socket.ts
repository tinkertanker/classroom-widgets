import { io, Socket } from 'socket.io-client';

// Simple socket factory - creates new socket instances
// This maintains the original behavior where each session gets its own socket
export const getSocket = (): Socket => {
  return io();
};

// Optional: Add a cleanup function for completeness
export const disconnectSocket = (socket: Socket): void => {
  if (socket) {
    socket.disconnect();
  }
};