import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from '../../../contexts/SessionContext';
import { useSocketEvents } from './useSocketEvents';
import { RoomType } from './useNetworkedWidget';
import { debug } from '@shared/utils/debug';

interface UseNetworkedWidgetStateOptions {
  widgetId?: string;
  roomType: RoomType;
  hasRoom: boolean;
  recoveryData: any;
}

interface UseNetworkedWidgetStateResult {
  isActive: boolean;
  toggleActive: () => void;
  setIsActive: (active: boolean) => void;
}

/**
 * Hook to manage the active/paused state of a networked widget.
 * Handles socket events for state changes and recovery data restoration.
 */
export function useNetworkedWidgetState({
  widgetId,
  roomType,
  hasRoom,
  recoveryData
}: UseNetworkedWidgetStateOptions): UseNetworkedWidgetStateResult {
  const unifiedSession = useSession();
  // A widget remounted over a live room (layout switch, compact overlay)
  // starts from the room's known state rather than "paused".
  const [isActive, setIsActive] = useState(
    () => (widgetId ? unifiedSession.activeRooms.get(widgetId)?.isActive : undefined) ?? false
  );

  // Socket event handlers for state changes
  const socketEvents = useMemo(() => ({
    'session:widgetStateChanged': (data: { roomType: string; widgetId?: string; isActive: boolean }) => {
      if (data.roomType === roomType && (data.widgetId === widgetId || (!data.widgetId && !widgetId))) {
        debug(`[${roomType}] Widget state changed to:`, data.isActive);
        setIsActive(data.isActive);
      }
    }
  }), [widgetId, roomType]);

  // Register socket events
  useSocketEvents({
    events: socketEvents,
    isActive: hasRoom
  });

  // Restore active state from recovery data
  useEffect(() => {
    if (recoveryData?.roomData && typeof recoveryData.roomData.isActive === 'boolean') {
      debug(`[${roomType}] Restoring active state from recovery:`, recoveryData.roomData.isActive);
      setIsActive(recoveryData.roomData.isActive);
    }
  }, [recoveryData, roomType]);

  // Auto-activate when room is first created (not recovery). A room that
  // already existed when this widget mounted is not new, so leave it alone.
  const hasAutoActivatedRef = useRef(hasRoom);
  useEffect(() => {
    // A recovered room is not new either, even once its snapshot is retired
    if (recoveryData) {
      hasAutoActivatedRef.current = true;
    }
    if (hasRoom && !recoveryData && !hasAutoActivatedRef.current && widgetId) {
      hasAutoActivatedRef.current = true;
      debug(`[${roomType}] Auto-activating widget on room creation`);
      unifiedSession.updateRoomState(roomType, widgetId, true);
    }
    if (!hasRoom) {
      hasAutoActivatedRef.current = false;
    }
  }, [hasRoom, recoveryData, widgetId, roomType, unifiedSession]);

  // Toggle active state
  const toggleActive = useCallback(() => {
    if (!widgetId || !hasRoom) return;
    unifiedSession.updateRoomState(roomType, widgetId, !isActive);
  }, [widgetId, hasRoom, unifiedSession, roomType, isActive]);

  return {
    isActive,
    toggleActive,
    setIsActive
  };
}
