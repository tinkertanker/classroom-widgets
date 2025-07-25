// NetworkedWidgetWrapper - Wrapper for widgets that need network connectivity

import React, { ReactNode } from 'react';
import { IconType } from 'react-icons';
import { NetworkedWidgetEmpty } from './NetworkedWidgetEmpty';
import { NetworkedWidgetHeader } from './NetworkedWidgetHeader';
import { useNetworkedWidget, RoomType } from '../../hooks/useNetworkedWidget';

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
    session: any;
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

  if (!isRoomActive) {
    return (
      <NetworkedWidgetEmpty
        title={title}
        description={description}
        icon={icon}
        onStart={handleStart}
        isStarting={isStarting}
        error={error}
      />
    );
  }

  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4 relative">
      <NetworkedWidgetHeader
        roomCode={session.sessionCode || ''}
        participantCount={session.participantCount}
        onStop={handleStop}
      >
        {headerChildren}
      </NetworkedWidgetHeader>
      
      <div className="flex-1 overflow-y-auto">
        {children({ session, isRoomActive })}
      </div>
    </div>
  );
};

export default NetworkedWidgetWrapper;