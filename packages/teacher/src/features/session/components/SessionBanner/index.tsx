// SessionBanner - Dynamic island-style session display with expand/collapse animation
// Extracted from TopControls for reusability

import React, { useState, useRef, useEffect } from 'react';
import { FaWifi, FaXmark } from 'react-icons/fa6';
import { clsx } from 'clsx';
import { useSession } from '../../../../contexts/SessionContext';
import { hudContainer, zIndex } from '@shared/utils/styles';

interface SessionBannerProps {
  className?: string;
}

interface ActiveSessionBannerProps {
  className: string;
  connected: boolean;
  connectionPhase: ReturnType<typeof useSession>['connectionPhase'];
  displayUrl?: string;
  onClose: () => void;
  onRetry: ReturnType<typeof useSession>['recoverSession'];
  sessionCode: string;
  socket: ReturnType<typeof useSession>['socket'];
}

const ActiveSessionBanner: React.FC<ActiveSessionBannerProps> = ({
  className,
  connected,
  connectionPhase,
  displayUrl,
  onClose,
  onRetry,
  sessionCode,
  socket
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const sessionIslandRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryInFlightRef = useRef(false);
  const recovering = connectionPhase === 'recovering';
  const deferred = connectionPhase === 'recovery-deferred';
  const recoveryPending = recovering || deferred;

  // The socket is already online in the deferred phase. Retry session reclaim,
  // not socket.connect(), and guard same-render double clicks as well as the UI.
  const handleRetryRecovery = async () => {
    if (!deferred || retryInFlightRef.current) return;
    retryInFlightRef.current = true;
    try {
      await onRetry(sessionCode);
    } finally {
      retryInFlightRef.current = false;
    }
  };

  // Auto-expand when disconnected to show status
  useEffect(() => {
    if (!connected) {
      setIsExpanded(true);
    }
  }, [connected]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Handle reconnection attempt
  const handleReconnect = React.useCallback(() => {
    if (!connected && socket && !socket.connected) {
      // Clear any existing timeout before creating a new one
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      setIsReconnecting(true);
      socket.connect();

      // Reset reconnecting state after a timeout
      reconnectTimeoutRef.current = setTimeout(() => {
        setIsReconnecting(false);
        reconnectTimeoutRef.current = null;
      }, 3000);
    }
  }, [connected, socket]);

  // Reset reconnecting state and clear timeout when connection status changes
  useEffect(() => {
    if (connected) {
      setIsReconnecting(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }
  }, [connected]);

  const handleCloseSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to close this session? All students will be disconnected.')) {
      if (socket) {
        socket.emit('session:close', { sessionCode });
      }
      onClose();
    }
  };

  // Use consistent styling with other HUD elements
  // Base: bg-soft-white/80, backdrop-blur-sm, shadow-md
  // SessionBanner keeps slightly stronger blur for readability of session code
  return (
    <div
      ref={sessionIslandRef}
      className={clsx("relative", className)}
    >
      {/* WiFi Icon Button - always stays inline */}
      <div
        onClick={() => {
          if (!connected) {
            handleReconnect();
          } else {
            setIsExpanded(!isExpanded);
          }
        }}
        className={clsx(
          "bg-soft-white/80 dark:bg-warm-gray-800/80",
          "backdrop-blur-md shadow-md",
          "border border-warm-gray-300/50 dark:border-warm-gray-600/50",
          "transition-all duration-500 ease-out cursor-pointer",
          !connected ? "animate-pulse" : "hover:scale-105",
          // On wide screens, expand inline as before
          isExpanded ? "max-[540px]:h-10 max-[540px]:px-2 max-[540px]:rounded-lg min-[540px]:px-4 min-[540px]:py-2 min-[540px]:rounded-full" : "h-10 px-2 min-[540px]:px-3 rounded-lg",
          "relative",
          zIndex.hud
        )}
        title={recovering ? 'Reconnecting to session' : deferred ? 'Session recovery paused' : !connected ? 'Click to reconnect' : 'Connected to server'}
      >
        <div className="flex items-center justify-center h-full">
          {/* WiFi Icon - Shows connection status */}
          <div className={clsx(
            'transition-colors duration-200',
            recoveryPending
              ? 'text-amber-600 dark:text-amber-400'
              : connected
              ? 'text-sage-600 dark:text-sage-400 animate-pulse'
              : isReconnecting
              ? 'text-amber-600 dark:text-amber-400 animate-pulse'
              : 'text-warm-gray-400 dark:text-warm-gray-500'
          )}>
            <FaWifi className="text-base" />
          </div>

          {/* Session Info - Inline on wide screens */}
          <div className={clsx(
            "items-center gap-2 min-w-0 transition-all duration-500",
            "max-[540px]:hidden",
            isExpanded ? "flex max-w-[1200px] opacity-100 ml-2 min-[540px]:ml-3" : "hidden max-w-0 opacity-0 overflow-hidden"
          )}>
            <code className="select-text text-2xl min-[540px]:text-5xl font-bold text-warm-gray-800 dark:text-warm-gray-200 tracking-wider leading-none">
              {sessionCode}
            </code>
            <div className="w-px h-6 min-[540px]:h-8 bg-warm-gray-300 dark:bg-warm-gray-600" />
            <span className="select-text text-sm min-[540px]:text-3xl font-semibold text-warm-gray-600 dark:text-warm-gray-300 truncate max-w-[160px] min-[540px]:max-w-[420px]">
              {displayUrl?.replace(/^https?:\/\//, '')}
            </span>
            {connected && (
              <>
                <div className="w-px h-3 min-[540px]:h-4 bg-warm-gray-300 dark:bg-warm-gray-600" />
                <button
                  onClick={handleCloseSession}
                  className="text-dusty-rose-600 dark:text-dusty-rose-400 hover:text-dusty-rose-700 dark:hover:text-dusty-rose-300 transition-colors p-1 rounded hover:bg-dusty-rose-100 dark:hover:bg-dusty-rose-900/20"
                  title="Close session"
                >
                  <FaXmark className="text-xs min-[540px]:text-sm" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expanded banner - drops below on narrow screens */}
      {isExpanded && (
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className={clsx(
            "hidden max-[540px]:flex",
            "absolute top-full right-0 mt-2",
            "bg-soft-white/80 dark:bg-warm-gray-800/80",
            "backdrop-blur-md shadow-md",
            "border border-warm-gray-300/50 dark:border-warm-gray-600/50",
            "rounded-full px-3 py-2 cursor-pointer",
            "items-center gap-2",
            "pointer-events-auto",
            zIndex.hud
          )}
        >
          <code className="select-text text-2xl font-bold text-warm-gray-800 dark:text-warm-gray-200 tracking-wider leading-none">
            {sessionCode}
          </code>
          <div className="w-px h-6 bg-warm-gray-300 dark:bg-warm-gray-600" />
          <span className="select-text text-sm font-semibold text-warm-gray-600 dark:text-warm-gray-300 truncate max-w-[160px]">
            {displayUrl?.replace(/^https?:\/\//, '')}
          </span>
          {connected && (
            <>
              <div className="w-px h-3 bg-warm-gray-300 dark:bg-warm-gray-600" />
              <button
                onClick={handleCloseSession}
                className="text-dusty-rose-600 dark:text-dusty-rose-400 hover:text-dusty-rose-700 dark:hover:text-dusty-rose-300 transition-colors p-1 rounded hover:bg-dusty-rose-100 dark:hover:bg-dusty-rose-900/20"
                title="Close session"
              >
                <FaXmark className="text-xs" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Recovery status is not collapsible with the session code. Keep the
          narrow warning inside the viewport, below the expanded code row. */}
      {recoveryPending && (
        <div
          role="status"
          aria-atomic="true"
          className={clsx(
            hudContainer.base,
            'absolute top-full right-0 mt-2 w-80 p-3 pointer-events-auto',
            'max-[540px]:fixed max-[540px]:top-28 max-[540px]:inset-x-2 max-[540px]:mt-0 max-[540px]:w-auto',
            'border-amber-400/70 dark:border-amber-600/70',
            zIndex.hudDropdown
          )}
        >
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            {recovering ? 'Reconnecting to session…' : 'Session recovery paused'}
          </p>
          <p className="mt-1 text-xs text-warm-gray-700 dark:text-warm-gray-200">
            {recovering
              ? 'Please wait before using classroom activities.'
              : 'Your session is not ready. Session details are saved; retry to reconnect.'}
          </p>
          <button
            type="button"
            aria-label="Retry session recovery"
            disabled={recovering}
            onClick={handleRetryRecovery}
            className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 disabled:cursor-wait disabled:opacity-60 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
          >
            {recovering ? 'Reconnecting…' : 'Retry recovery'}
          </button>
        </div>
      )}
    </div>
  );
};

const SessionBanner: React.FC<SessionBannerProps> = ({
  className = ''
}) => {
  const session = useSession();
  const { sessionCode, isConnected: connected, closeSession: onClose, serverUrl, studentAppUrl } = session;

  // Use studentAppUrl if available (provided by server), fall back to serverUrl
  const displayUrl = studentAppUrl || serverUrl;
  if (!sessionCode) return null;

  return (
    <ActiveSessionBanner
      key={sessionCode}
      className={className}
      connected={connected}
      connectionPhase={session.connectionPhase}
      displayUrl={displayUrl}
      onClose={onClose}
      onRetry={session.recoverSession}
      sessionCode={sessionCode}
      socket={session.socket}
    />
  );
};

export default SessionBanner;
