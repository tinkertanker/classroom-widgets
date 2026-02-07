import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [isActive, setIsActive] = useState(false);
  const unifiedSession = useSession();

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
