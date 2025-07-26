import React, { ReactNode } from 'react';
import { IconType } from 'react-icons';
import { NetworkedWidgetEmpty } from './NetworkedWidgetEmpty';
import { NetworkedWidgetHeader } from './NetworkedWidgetHeader';
import { useNetworkedWidget } from '../../hooks/useNetworkedWidget';
import { RoomType } from '../../hooks/useNetworkedWidget';

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

  // Debug logging
  // console.log(`[Widget ${widgetId}] NetworkedWidgetWrapper render:`, {
  //   isRoomActive,
  //   sessionCode: session.sessionCode,
  //   isConnected: session.isConnected,
  //   showingEmptyState: !isRoomActive || !session.sessionCode
  // });

  // Empty state
  if (!isRoomActive || !session.sessionCode) {
    return (
      <NetworkedWidgetEmpty
        icon={icon}
        title={title}
        description={description}
        buttonText={
          isStarting ? "Starting..." : 
          !session.isConnected ? "Connecting..." : 
          `Start ${title}`
        }
        onStart={handleStart}
        disabled={isStarting || !session.isConnected}
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
        {headerChildren}
      </NetworkedWidgetHeader>
      
      {content}
    </div>
  );
};