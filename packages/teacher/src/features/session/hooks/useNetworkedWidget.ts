import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../../../contexts/SessionContext';
import type { SessionEditorScope } from './useSessionEditor';

export type RoomType = 'poll' | 'linkShare' | 'rtfeedback' | 'questions' | 'handout' | 'activity';

interface UseNetworkedWidgetProps {
  widgetId?: string;
  roomType: RoomType;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface UseNetworkedWidgetResult {
  // Room state
  hasRoom: boolean;
  isStarting: boolean;
  error: string | null;
  
  // Actions
  handleStart: () => Promise<void>;
  handleStop: () => void;
  canEdit: () => boolean;
  editorScope: SessionEditorScope;
  
  // Session info
  session: {
    socket: any;
    sessionCode: string | null;
    participantCount: number;
    isConnected: boolean;
    isRecovering: boolean;
    isRecoveryDeferred: boolean;
    isReady: boolean;
  };
  
  // Recovery data
  recoveryData: any | null;
}

export function useNetworkedWidget({
  widgetId,
  roomType,
  savedState,
  onStateChange
}: UseNetworkedWidgetProps): UseNetworkedWidgetResult {
  const session = useSession();
  // The session's room list is the single source of truth: it is filled by
  // createRoom, session:roomCreated and recovery, and emptied by
  // session:roomClosed and session close. Deriving from it means a widget that
  // remounts (layout switch, compact overlay) shows its live room at once.
  const hasRoom = widgetId ? session.activeRooms.has(widgetId) : false;
  const [isStarting, setIsStarting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Handle start
  const handleStart = useCallback(async () => {
    if (!session.canEditSession()) return;
    if (!widgetId) {
      setLocalError('Widget ID is required');
      return;
    }
    
    setIsStarting(true);
    setLocalError(null);
    
    try {
      // Ensure we have a session first
      let sessionCode = session.sessionCode;
      if (!sessionCode) {
        sessionCode = await session.createSession();
        if (!sessionCode) {
          throw new Error('Failed to create session');
        }
        
        // Wait a bit for the session to propagate through the context
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Create the room. On success the session records it in activeRooms,
      // which is where hasRoom comes from.
      const success = await session.createRoom(roomType, widgetId);
      if (!success) {
        throw new Error('Failed to create room');
      }

      setIsStarting(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start';
      setLocalError(errorMessage);
      setIsStarting(false);
      console.error('[NetworkedWidget] Start error:', err);
    }
  }, [widgetId, roomType, session]);
  
  // Handle stop
  const handleStop = useCallback(() => {
    if (!widgetId) return;
    
    session.closeRoom(roomType, widgetId);
  }, [widgetId, roomType, session]);
  
  // Unmounting never closes the room: layout switches and the compact overlay
  // unmount widgets that are still on the board. SessionContext closes a room
  // when its widget is removed from the board.

  // Get recovery data
  const recoveryData = widgetId ? session.getWidgetRecoveryData(widgetId) : null;

  // A recovery snapshot is for the widget to restore from once: the widget's
  // restore effects see it in this render, and from then on its saved state is
  // newer. Retire it so a remount (layout switch, compact overlay) does not
  // roll the widget back to it.
  const releaseRecoveryData = session.releaseWidgetRecoveryData;
  useEffect(() => {
    if (widgetId && recoveryData) releaseRecoveryData(widgetId);
  }, [widgetId, recoveryData, releaseRecoveryData]);
  
  // Get participant count for this widget
  const participantCount = widgetId ? (session.activeRooms.get(widgetId)?.participantCount ?? 0) : 0;
  
  return {
    hasRoom,
    isStarting,
    error: localError || session.error,
    handleStart,
    handleStop,
    canEdit: session.canEditSession,
    editorScope: session,
    session: {
      socket: session.socket,
      sessionCode: session.sessionCode,
      participantCount,
      isConnected: session.isConnected,
      isRecovering: session.isRecovering,
      isRecoveryDeferred: session.connectionPhase === 'recovery-deferred',
      // No session is a valid start state; an existing one must be reclaimed.
      isReady: session.isConnected && (!session.sessionCode || session.isSessionReady)
    },
    recoveryData
  };
}
