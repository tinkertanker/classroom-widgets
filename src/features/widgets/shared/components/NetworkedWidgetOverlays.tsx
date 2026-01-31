import React from 'react';

interface NetworkedWidgetOverlaysProps {
  isActive: boolean;
  isConnected: boolean;
  isRecovering: boolean;
  pausedMessage: string;
}

/**
 * Shared overlay components for networked widgets.
 * Renders paused, reconnecting, and disconnected states.
 */
export const NetworkedWidgetOverlays: React.FC<NetworkedWidgetOverlaysProps> = ({
  isActive,
  isConnected,
  isRecovering,
  pausedMessage
}) => {
  return (
    <>
      {/* Paused overlay - when widget is paused but connected */}
      {!isActive && isConnected && !isRecovering && (
        <div className="absolute inset-0 bg-white/60 dark:bg-warm-gray-800/60 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-10">
          <div className="text-center bg-white/90 dark:bg-warm-gray-800/90 rounded-lg px-6 py-4 shadow-lg">
            <p className="text-warm-gray-700 dark:text-warm-gray-300 font-medium mb-2">{pausedMessage}</p>
            <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Click play to resume</p>
          </div>
        </div>
      )}

      {/* Reconnecting overlay */}
      {isRecovering && (
        <div className="absolute inset-0 bg-white/80 dark:bg-warm-gray-800/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sage-500 border-t-transparent mb-2"></div>
            <p className="text-warm-gray-600 dark:text-warm-gray-400 text-sm">Reconnecting to session...</p>
          </div>
        </div>
      )}

      {/* Disconnected overlay */}
      {!isConnected && !isRecovering && (
        <div className="absolute inset-0 bg-white/80 dark:bg-warm-gray-800/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <p className="text-dusty-rose-600 dark:text-dusty-rose-400 text-sm font-medium mb-1">Disconnected</p>
            <p className="text-warm-gray-600 dark:text-warm-gray-400 text-xs">Check your connection</p>
          </div>
        </div>
      )}
    </>
  );
};

export default NetworkedWidgetOverlays;
