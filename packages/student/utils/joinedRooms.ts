import type { ComponentProps } from 'react';
import type { Socket } from 'socket.io-client';
import type PollActivity from '../components/PollActivity';
import type LinkShareActivity from '../components/LinkShareActivity';
import type HandoutActivity from '../components/HandoutActivity';
import type { ActivityRenderer } from '../components/activity';
import type { RoomType } from './roomTypeMeta';

/**
 * The room snapshot the server sends with session:joined and
 * session:roomCreated. Each room type reads only its own fields.
 */
export interface RoomInitialData {
  isActive?: boolean;
  pollData?: ComponentProps<typeof PollActivity>['initialPollData'];
  acceptMode?: ComponentProps<typeof LinkShareActivity>['initialAcceptMode'];
  items?: ComponentProps<typeof HandoutActivity>['initialItems'];
  activity?: ComponentProps<typeof ActivityRenderer>['initialActivity'];
  actions?: ComponentProps<typeof ActivityRenderer>['initialActions'];
}

/** One entry of `activeRooms` in session:joined */
export interface SessionRoomSnapshot {
  roomType: RoomType;
  widgetId?: string;
  room?: RoomInitialData;
}

export interface SessionJoinedEvent {
  success: boolean;
  activeRooms?: SessionRoomSnapshot[];
  error?: string;
  message?: string;
}

export interface SessionRoomCreatedEvent {
  roomType: RoomType;
  widgetId?: string;
  roomData?: RoomInitialData;
}

export interface SessionRoomEvent {
  roomType: RoomType;
  widgetId?: string;
}

export interface SessionWidgetStateChangedEvent extends SessionRoomEvent {
  isActive: boolean;
}

export interface JoinedRoom {
  id: string;
  code: string;
  type: RoomType;
  studentName: string;
  studentId: string;
  socket: Socket;
  joinedAt: number;
  initialData?: RoomInitialData; // Store initial poll/activity data
  widgetId?: string; // Widget instance ID for multiple instances
  isActive: boolean; // Track active state for header styling
}

/**
 * Real identity of a joined activity: one card per widget instance within a session.
 * Deliberately excludes `id`, which carries a Date.now() suffix and so never matches
 * across two events for the same room.
 */
export const roomIdentity = (room: { code: string; type: RoomType; widgetId?: string }): string =>
  `${room.code}:${room.type}:${room.widgetId ?? ''}`;

/**
 * Idempotent insert-or-update for the joined room list, keyed by roomIdentity.
 * A room we have not seen goes to the front (newest first); a room we already have keeps
 * its card id, position and joinedAt while taking the server's latest data. Every write
 * path goes through here, so the repeat session:joined / session:roomCreated events that
 * arrive on each reconnect refresh the existing cards instead of duplicating them.
 */
export const upsertJoinedRoom = (rooms: JoinedRoom[], incoming: JoinedRoom): JoinedRoom[] => {
  const key = roomIdentity(incoming);
  const existingIndex = rooms.findIndex(room => roomIdentity(room) === key);

  if (existingIndex === -1) {
    return [incoming, ...rooms];
  }

  const updated = [...rooms];
  updated[existingIndex] = {
    ...rooms[existingIndex],
    studentName: incoming.studentName,
    studentId: incoming.studentId,
    socket: incoming.socket,
    initialData: incoming.initialData,
    isActive: incoming.isActive
  };
  return updated;
};

interface JoinedRoomInput {
  code: string;
  roomType: RoomType;
  widgetId?: string;
  data?: RoomInitialData;
  studentName: string;
  studentId: string;
  socket: Socket;
}

/**
 * A fresh card for a room the server reports. Its id is unique per call, so
 * an existing card for the same room keeps its own id through upsertJoinedRoom.
 */
export const createJoinedRoom = ({
  code,
  roomType,
  widgetId,
  data,
  studentName,
  studentId,
  socket
}: JoinedRoomInput): JoinedRoom => {
  const computedRoomId = widgetId ? `${roomType}:${widgetId}` : roomType;
  return {
    id: `${code}-${computedRoomId}-${Date.now()}`,
    code,
    type: roomType,
    studentName,
    studentId,
    socket,
    joinedAt: Date.now(),
    initialData: data || {},
    widgetId,
    isActive: data?.isActive || false
  };
};
