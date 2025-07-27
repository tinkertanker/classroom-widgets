import { io, Socket } from 'socket.io-client';

// Simple socket manager - keeps a single socket instance
let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io();
  }
  return socket;
};

// Optional: Add a cleanup function for completeness
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};