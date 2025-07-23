import React, { ReactNode } from 'react';
import { IconType } from 'react-icons';
import { NetworkedWidgetEmpty } from './NetworkedWidgetEmpty';
import { NetworkedWidgetHeader } from './NetworkedWidgetHeader';
import { useNetworkedWidgetSession } from '../../hooks/useNetworkedWidgetSession';
import { RoomType } from '../../hooks/useSession';

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
    session: ReturnType<typeof useNetworkedWidgetSession>['session'];
    isRoomActive: boolean;
  }) => ReactNode;
  headerChildren?: ReactNode;
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
  } = useNetworkedWidgetSession({
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
          session.isConnecting ? "Connecting..." : 
          `Start ${title}`
        }
        onStart={handleStart}
        disabled={isStarting || session.isConnecting || !session.isConnected}
        error={error || session.connectionError}
      />
    );
  }

  // Active state
  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4 relative">
      <NetworkedWidgetHeader 
        roomCode={session.sessionCode}
        participantCount={session.participantCount}
      >
        {headerChildren}
      </NetworkedWidgetHeader>
      
      {content}
    </div>
  );
};