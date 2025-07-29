import React, { ReactNode } from 'react';
import { IconType } from 'react-icons';
import { NetworkedWidgetEmpty } from './NetworkedWidgetEmpty';
import { NetworkedWidgetHeader } from './NetworkedWidgetHeader';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { RoomType } from '../../session/hooks/useNetworkedWidget';

interface NetworkedWidgetWrapperProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
  roomType: RoomType;
  title: string;
  description: string;
  icon: IconType;
  onRoomCreated?: () => void;
  onRoomClosed?: () => void;
  children: (props: {
    session: ReturnType<typeof useNetworkedWidget>['session'];
    isRoomActive: boolean;
  }) => ReactNode;
  headerChildren?: (props: {
    session: ReturnType<typeof useNetworkedWidget>['session'];
    isRoomActive: boolean;
    widgetId?: string;
  }) => ReactNode;
}

export const NetworkedWidgetWrapper: React.FC<NetworkedWidgetWrapperProps> = ({
  widgetId,
  savedState,
  onStateChange,
  roomType,
  title,
  description,
  icon,
  onRoomCreated,
  onRoomClosed,
  children,
  headerChildren
}) => {
  const {
    isRoomActive,
    isStarting,
    error,
    handleStart,
    handleStop,
    session
  } = useNetworkedWidget({
    widgetId,
    roomType,
    onRoomCreated,
    onRoomClosed,
    savedState,
    onStateChange
  });

  // Always render children to ensure hooks are called consistently
  const content = children({ session, isRoomActive });

  // Empty state
  if (!isRoomActive || !session.sessionCode) {
    return (
      <NetworkedWidgetEmpty
        icon={icon}
        title={title}
        description={description}
        buttonText={
          isStarting ? "Starting..." : 
          session.isRecovering ? "Reconnecting..." :
          !session.isConnected ? "Connecting..." : 
          `Start ${title}`
        }
        onStart={handleStart}
        disabled={isStarting || !session.isConnected || session.isRecovering}
        error={error}
      />
    );
  }

  // Active state
  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4 relative">
      <NetworkedWidgetHeader 
        title={title}
        code={session.sessionCode}
        participantCount={session.participantCount}
        icon={icon}
      >
        {headerChildren?.({ session, isRoomActive, widgetId })}
      </NetworkedWidgetHeader>
      
      {/* Connection status overlay */}
      {session.isRecovering && (
        <div className="absolute inset-0 bg-white/80 dark:bg-warm-gray-800/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sage-500 border-t-transparent mb-2"></div>
            <p className="text-warm-gray-600 dark:text-warm-gray-400 text-sm">Reconnecting to session...</p>
          </div>
        </div>
      )}
      
      {!session.isConnected && !session.isRecovering && (
        <div className="absolute inset-0 bg-white/80 dark:bg-warm-gray-800/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <p className="text-dusty-rose-600 dark:text-dusty-rose-400 text-sm font-medium mb-1">Disconnected</p>
            <p className="text-warm-gray-600 dark:text-warm-gray-400 text-xs">Check your connection</p>
          </div>
        </div>
      )}
      
      {content}
    </div>
  );
};