import type { Socket } from 'socket.io-client';
import type { SessionCreateData, SessionCreatedResponse } from '@shared/types/socket.types';
import type { ActiveRoom } from './sessionTypes';

// A stored session is always offered back to the server, whatever its age:
// the server decides whether it is still alive (host reconnect grace and
// idle-room expiry in packages/server/src/config/constants.js). If it is
// gone, recovery fails and the next widget start creates a new session.
export const RECOVERY_TIMEOUT = 5000; // 5 seconds per attempt
export const MAX_RECOVERY_ATTEMPTS = 3;

export const SESSION_ENDED_MESSAGE = 'Your previous session ended. Press Start to begin a new one.';

// Upper bound for a setTimeout delay; larger retryAfter hints are not honoured
const MAX_TIMER_DELAY_MS = 2_147_483_646;

export const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.message === 'Aborted';

/** A delay that rejects with `Error('Aborted')` when `signal` aborts. */
export const abortableDelay = (ms: number, signal?: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new Error('Aborted'));
    };
    // Detach the abort listener once the delay completes — recovery retries
    // reuse the same signal, so leaked listeners would accumulate and fire
    // stale rejections on a later abort
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
};

/**
 * One reclaim request. Rejects on timeout or abort; resolves with the server's
 * answer otherwise, whether it accepted the reclaim or not.
 */
export const requestSessionReclaim = (
  socket: Socket,
  // A missing token is sent as null, which the server treats as no token
  payload: Omit<SessionCreateData, 'hostToken'> & { hostToken: string | null },
  signal: AbortSignal,
  attempt: number
): Promise<SessionCreatedResponse> => new Promise((resolve, reject) => {
  // Set up timeout for this attempt; detach the abort listener on
  // this path too — the signal is shared across retry attempts
  const timeoutId = setTimeout(() => {
    signal.removeEventListener('abort', abortHandler);
    reject(new Error(`Recovery attempt ${attempt} timed out`));
  }, RECOVERY_TIMEOUT);

  const abortHandler = () => {
    clearTimeout(timeoutId);
    reject(new Error('Aborted'));
  };
  signal.addEventListener('abort', abortHandler, { once: true });

  socket.emit('session:create', payload, (result: SessionCreatedResponse) => {
    clearTimeout(timeoutId);
    signal.removeEventListener('abort', abortHandler);

    if (signal.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    resolve(result);
  });
});

/**
 * The backoff before the next attempt after a throttled answer, or null when
 * the hint is unusable. Invalid/overflowing timer hints must not turn into a
 * hot loop or destructive cleanup; the caller defers until an explicit retry
 * or reconnect.
 */
export const retryDelayAfterThrottle = (backoff: number, retryAfter: number): number | null => {
  if (!Number.isFinite(retryAfter) || retryAfter < 0 || retryAfter > MAX_TIMER_DELAY_MS) return null;
  // The fixed window expires at age > windowMs. Cross that boundary by
  // 1ms; retain backoff for retryAfter: 0 instead of immediately retrying.
  return Math.max(backoff, Math.ceil(retryAfter) + 1);
};

type RecoveredRooms = Extract<SessionCreatedResponse, { success: true }>['activeRooms'];

/** The rooms a reclaimed session still holds, keyed by widget id. */
export const roomsFromRecovery = (activeRooms: RecoveredRooms): Map<string, ActiveRoom> => {
  const rooms = new Map<string, ActiveRoom>();
  (activeRooms || []).forEach((roomInfo) => {
    if (roomInfo.widgetId) {
      rooms.set(roomInfo.widgetId, {
        roomType: roomInfo.roomType,
        widgetId: roomInfo.widgetId,
        isActive: roomInfo.room?.isActive || false,
        participantCount: roomInfo.room?.participantCount || 0,
        roomData: roomInfo.room
      });
    }
  });
  return rooms;
};
