import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import { debug } from '@shared/utils/debug';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { networkedWidgetIds } from './networkedWidgets';
import type { ActiveRoom, ConnectionPhase } from './sessionTypes';

interface OrphanedRoomCleanupOptions {
  socket: Socket | null;
  sessionCode: string | null;
  connectionPhase: ConnectionPhase;
  setActiveRooms: Dispatch<SetStateAction<Map<string, ActiveRoom>>>;
}

/**
 * Closes server rooms whose networked widget is no longer on the board, both
 * as widgets leave and once after a session is (re)established.
 */
export const useOrphanedRoomCleanup = ({
  socket,
  sessionCode,
  connectionPhase,
  setActiveRooms
}: OrphanedRoomCleanupOptions): void => {
  // A string so the selector result is stable between unrelated store updates
  const boardNetworkedWidgetIds = useWorkspaceStore((state) => networkedWidgetIds(state.widgets).join('\n'));

  // Clean up orphaned rooms - called after recovery or when widgets are deleted
  // Uses the new session:cleanupRooms event for more efficient server-side cleanup
  const cleanupOrphanedRooms = useCallback(() => {
    if (!socket?.connected || !sessionCode) return;

    // The networked widgets currently on the board
    const activeWidgetIds = networkedWidgetIds(useWorkspaceStore.getState().widgets);

    console.log('[UnifiedSession] cleanupOrphanedRooms: Found networked widgets:', activeWidgetIds);

    // Send cleanup request to server with list of active widget IDs
    // Server will close any rooms not in this list
    socket.emit('session:cleanupRooms', {
      sessionCode,
      activeWidgetIds
    });

    // Update local state to remove orphaned rooms
    setActiveRooms(prev => {
      const next = new Map(prev);
      let hasChanges = false;
      prev.forEach((_, widgetId) => {
        if (!activeWidgetIds.includes(widgetId)) {
          debug('[UnifiedSession] Removing orphaned room from local state:', widgetId);
          next.delete(widgetId);
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });

    debug('[UnifiedSession] Orphaned room cleanup complete');
  }, [socket, sessionCode, setActiveRooms]);

  // A room belongs to a widget on the board, not to a mounted component: layout
  // switches and the compact overlay unmount widgets without deleting them.
  // Close rooms when a networked widget leaves the board (deleted, or its
  // workspace switched away). Offline deletions are caught by the
  // post-recovery cleanup below.
  const previousBoardWidgetIdsRef = useRef(boardNetworkedWidgetIds);
  useEffect(() => {
    const previous = previousBoardWidgetIdsRef.current;
    previousBoardWidgetIdsRef.current = boardNetworkedWidgetIds;
    if (!previous) return;
    const current = new Set(boardNetworkedWidgetIds.split('\n'));
    if (previous.split('\n').some(id => !current.has(id))) {
      cleanupOrphanedRooms();
    }
  }, [boardNetworkedWidgetIds, cleanupOrphanedRooms]);

  // Schedule cleanup after recovery completes and widgets have had time to mount
  // This handles the case where widgets were deleted while offline
  useEffect(() => {
    console.log('[UnifiedSession] Cleanup useEffect triggered:', {
      connectionPhase,
      socketConnected: socket?.connected,
      sessionCode
    });

    // Only run once the session is established (recovered or freshly created)
    if (connectionPhase !== 'recovered') {
      console.log('[UnifiedSession] Cleanup skipped: not ready');
      return;
    }
    if (!socket?.connected || !sessionCode) {
      console.log('[UnifiedSession] Cleanup skipped: no socket or session');
      return;
    }

    // Wait for widgets to mount before cleaning up orphaned rooms
    // This delay ensures React has rendered all widgets before we check
    console.log('[UnifiedSession] Scheduling cleanup in 2 seconds...');
    const cleanupTimer = setTimeout(() => {
      console.log('[UnifiedSession] Running post-recovery cleanup NOW');
      cleanupOrphanedRooms();
    }, 2000); // 2 second delay to allow widgets to mount

    return () => {
      console.log('[UnifiedSession] Cleanup timer cancelled');
      clearTimeout(cleanupTimer);
    };
  }, [connectionPhase, socket?.connected, sessionCode, cleanupOrphanedRooms]);
};
