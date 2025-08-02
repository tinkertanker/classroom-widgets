import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaPlay, FaPause, FaChartColumn, FaGear, FaArrowRotateLeft } from 'react-icons/fa6';
import { useModal } from '../../../contexts/ModalContext';
import { WidgetProvider } from '../../../contexts/WidgetContext';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { NetworkedWidgetHeader } from '../shared/NetworkedWidgetHeader';
import { useWidgetSocket } from '../shared/hooks';
import { getPollColor } from '../../../shared/constants/pollColors';
import PollSettings from './PollSettings';
import { getRandomPollQuestion } from './pollQuestions';
import { useWidget } from '../../../shared/hooks/useWidget';

interface PollProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface PollData {
  question: string;
  options: string[];
}

interface PollResults {
  votes: { [key: number]: number };
  totalVotes: number;
  participantCount: number;
}

// Create a mock context for PollSettings compatibility
export const usePollContext = () => {
  throw new Error('usePollContext is not available in the simplified version');
};

function Poll({ widgetId, savedState, onStateChange }: PollProps) {
  // State
  const [pollData, setPollData] = useState<PollData>(() => {
    if (savedState?.pollData) {
      return savedState.pollData;
    }
    // Get a random question for new widgets
    const randomQuestion = getRandomPollQuestion();
    return {
      question: randomQuestion.question,
      options: randomQuestion.options
    };
  });
  
  const [results, setResults] = useState<PollResults>(() => savedState?.results || {
    votes: {},
    totalVotes: 0,
    participantCount: 0
  });
  
  const [showOverlay, setShowOverlay] = useState(true);
  const [hasAutoResized, setHasAutoResized] = useState(false);
  const [isWidgetActive, setIsWidgetActive] = useState(false); // Track actual widget active state
  
  // Hooks
  const { showModal, hideModal } = useModal();
  const { widget, resize } = useWidget(widgetId || '');
  
  // Networked widget hook
  const {
    hasRoom,
    isStarting,
    error,
    handleStart,
    handleStop,
    session
  } = useNetworkedWidget({
    widgetId,
    roomType: 'poll',
    savedState,
    onStateChange
  });
  
  // Socket event handlers
  const socketEvents = useMemo(() => ({
    'poll:updated': (data: any) => {
      console.log('[Poll] Received poll:updated:', data);
      setPollData(data);
    },
    'poll:dataUpdate': (data: any) => {
      console.log('[Poll] Received poll:dataUpdate:', data, 'for widget:', widgetId);
      // Only process if this update is for our widget
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        console.log('[Poll] Processing dataUpdate for our widget');
        if (data.pollData) {
          setPollData(data.pollData);
        }
        if (data.results) {
          setResults({
            votes: data.results.votes || {},
            totalVotes: data.results.totalVotes || 0,
            participantCount: data.results.participantCount || 0
          });
        }
      }
    },
    'poll:voteUpdate': (data: any) => {
      console.log('[Poll] Received poll:voteUpdate:', data, 'for widget:', widgetId);
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        console.log('[Poll] Updating vote results');
        setResults(prevResults => ({
          ...prevResults,
          votes: data.votes,
          totalVotes: data.totalVotes,
        }));
      }
    },
    'session:widgetStateChanged': (data: { roomType: string; widgetId?: string; isActive: boolean }) => {
      console.log('[Poll] Received session:widgetStateChanged:', data, 'for widget:', widgetId);
      if (data.roomType === 'poll' && (data.widgetId === widgetId || (!data.widgetId && !widgetId))) {
        console.log('[Poll] Updating widget active state to:', data.isActive);
        setIsWidgetActive(data.isActive);
      } else {
        console.log('[Poll] Ignoring event - roomType or widgetId mismatch', {
          eventRoomType: data.roomType,
          myRoomType: 'poll',
          eventWidgetId: data.widgetId,
          myWidgetId: widgetId,
          match: data.widgetId === widgetId
        });
      }
    }
  }), [widgetId]);
  
  // Widget socket hook
  const { emitWidgetEvent, toggleActive, hasJoinedRoom } = useWidgetSocket({
    socket: session.socket,
    sessionCode: session.sessionCode,
    roomType: 'poll',
    widgetId,
    isActive: hasRoom,
    hasRoom,
    events: socketEvents,
    startEvent: 'session:poll:start',
    stopEvent: 'session:poll:stop'
  });
  
  // Debug logging
  useEffect(() => {
    console.log('[Poll] Widget socket state:', {
      hasRoom,
      hasJoinedRoom,
      isWidgetActive,
      socketConnected: session.socket?.connected
    });
  }, [hasRoom, hasJoinedRoom, isWidgetActive, session.socket]);
  
  // Actions
  const updatePoll = useCallback((data: Partial<PollData>) => {
    const newPollData = { ...pollData, ...data };
    setPollData(newPollData);
    
    if (hasRoom) {
      emitWidgetEvent('update', { pollData: newPollData });
    }
  }, [pollData, hasRoom, emitWidgetEvent]);
  
  const handleToggleActive = useCallback(() => {
    console.log('[Poll] handleToggleActive called, current state:', isWidgetActive);
    if (!pollData.question || pollData.options.filter(o => o).length < 2) {
      console.log('[Poll] Cannot toggle - invalid question or options');
      return;
    }
    
    const newState = !isWidgetActive;
    console.log('[Poll] Toggling active state to:', newState);
    toggleActive(newState);
    
    // Always send the poll data when toggling state
    if (hasRoom) {
      console.log('[Poll] Sending poll data with state change');
      emitWidgetEvent('update', { pollData });
    }
  }, [pollData, toggleActive, isWidgetActive, hasRoom, emitWidgetEvent]);
  
  const openSettings = useCallback(() => {
    showModal({
      title: 'Poll Settings',
      content: <PollSettings 
        initialData={{
          question: pollData.question,
          options: pollData.options
        }}
        onSave={(data) => {
          updatePoll(data);
          hideModal();
          
          // Auto-resize if number of options changed
          if (data.options.length !== pollData.options.length && widget && resize) {
            const baseHeight = 200;
            const optionHeight = 60;
            const maxOptions = 6;
            const visibleOptions = Math.min(data.options.length, maxOptions);
            const calculatedHeight = baseHeight + (visibleOptions * optionHeight);
            
            console.log(`[Poll] Auto-resizing after settings change to height: ${calculatedHeight} for ${data.options.length} options`);
            resize({ width: widget.size.width, height: calculatedHeight });
          }
        }} 
        onClose={hideModal} 
      />,
      onClose: hideModal
    });
  }, [showModal, hideModal, updatePoll, pollData]);
  
  const resetVotes = useCallback(() => {
    if (!session.socket || !session.sessionCode || !hasRoom) return;
    
    console.log('[Poll] Resetting votes');
    session.socket.emit('session:poll:reset', {
      sessionCode: session.sessionCode,
      widgetId
    });
    
    // Clear local results immediately for responsive UI
    setResults({
      votes: {},
      totalVotes: 0,
      participantCount: 0
    });
  }, [session.socket, session.sessionCode, widgetId, hasRoom]);
  
  // Auto-resize only on initial widget creation
  useEffect(() => {
    if (!widget || !resize || !widgetId || hasAutoResized) return;
    
    // Only auto-resize once when the widget is first created (not loaded from saved state)
    if (!savedState && widget.size) {
      // Calculate height based on number of options
      const baseHeight = 200; // Header + question + buttons + padding
      const optionHeight = 60; // Height per option including gap
      const maxOptions = 6; // Maximum visible options before it becomes too tall
      
      const visibleOptions = Math.min(pollData.options.length, maxOptions);
      const calculatedHeight = baseHeight + (visibleOptions * optionHeight);
      
      console.log(`[Poll] Auto-resizing new widget to height: ${calculatedHeight} for ${pollData.options.length} options`);
      resize({ width: widget.size.width, height: calculatedHeight });
      setHasAutoResized(true);
    }
  }, [widget, resize, widgetId, savedState, hasAutoResized, pollData.options.length]);
  
  // Effects
  useEffect(() => {
    if (!isWidgetActive) {
      setShowOverlay(true);
    } else {
      const timer = setTimeout(() => setShowOverlay(false), 50);
      return () => clearTimeout(timer);
    }
  }, [isWidgetActive]);
  
  // Cleanup on unmount
  useEffect(() => {
    console.log('[Poll] Widget mounted, widgetId:', widgetId);
    
    // Store current values in a ref to access them in cleanup
    const cleanupRef = { handleStop, sessionCode: session.sessionCode };
    
    return () => {
      console.log('[Poll] Widget unmounting. widgetId:', widgetId, 'sessionCode:', cleanupRef.sessionCode);
      // Always try to close the room on unmount if we have a session
      // This ensures cleanup happens even if the room was paused before deletion
      if (cleanupRef.sessionCode && cleanupRef.handleStop) {
        console.log('[Poll] Calling handleStop to ensure room cleanup');
        cleanupRef.handleStop();
      }
    };
  }, [handleStop, session.sessionCode]);
  
  useEffect(() => {
    onStateChange?.({
      pollData,
      results
    });
  }, [onStateChange, pollData, results]);
  
  // Send poll data when room is first established
  useEffect(() => {
    if (hasRoom && session.socket && session.sessionCode && pollData.question && pollData.options.length > 0) {
      // Small delay to ensure room is fully established on server
      const timer = setTimeout(() => {
        console.log('[Poll] Room established, sending initial poll data directly');
        // Send directly via socket to bypass the isActive check in emitWidgetEvent
        session.socket.emit('session:poll:update', {
          sessionCode: session.sessionCode,
          widgetId,
          pollData
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasRoom]); // Only trigger when hasRoom changes
  
  // Log when socket events are registered
  useEffect(() => {
    console.log('[Poll] Socket events effect running, socket:', !!session.socket, 'events:', Object.keys(socketEvents));
  }, [session.socket, socketEvents]);
  
  
  // Empty state - only show when no session exists
  if (!session.sessionCode) {
    return (
      <NetworkedWidgetEmpty
        icon={FaChartColumn}
        title="Poll"
        description="Create interactive polls for your students"
        buttonText={
          isStarting ? "Starting..." : 
          session.isRecovering ? "Reconnecting..." :
          !session.isConnected ? "Connecting..." : 
          "Start Poll"
        }
        onStart={handleStart}
        disabled={isStarting || !session.isConnected || session.isRecovering}
        error={error || undefined}
      />
    );
  }
  
  // Active state
  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4 relative">
      {/* Header */}
      <NetworkedWidgetHeader 
        title="Poll"
        code={session.sessionCode || ''}
        participantCount={session.participantCount}
        icon={FaChartColumn}
      >
        <div className="flex gap-2">
          <button
            onClick={handleToggleActive}
            disabled={!session.isConnected || !pollData.question || pollData.options.every(opt => !opt)}
            className={`p-2 rounded ${
              isWidgetActive 
                ? 'text-dusty-rose-600 hover:text-dusty-rose-700 dark:text-dusty-rose-400 dark:hover:text-dusty-rose-300 hover:bg-dusty-rose-100 dark:hover:bg-dusty-rose-900/20' 
                : 'text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 hover:bg-sage-100 dark:hover:bg-sage-900/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isWidgetActive ? "Pause poll" : "Start poll"}
          >
            {isWidgetActive ? <FaPause className="text-base" /> : <FaPlay className="text-base" />}
          </button>
          {results.totalVotes > 0 && (
            <button
              onClick={resetVotes}
              className="p-2 rounded text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors"
              title="Reset votes"
            >
              <FaArrowRotateLeft className="text-base" />
            </button>
          )}
          <button
            onClick={openSettings}
            className="p-2 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors"
            title="Settings"
          >
            <FaGear className="text-base" />
          </button>
        </div>
      </NetworkedWidgetHeader>
      
      {/* Vote count */}
      <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-1">
        {results.totalVotes} vote{results.totalVotes !== 1 ? 's' : ''}
      </div>

      {/* Poll content */}
      <div className="flex-1 flex flex-col relative">
        {/* Paused overlay */}
        {showOverlay && !isWidgetActive && session.isConnected && (
          <div className="absolute inset-0 bg-white/80 dark:bg-warm-gray-800/80 rounded-lg flex items-center justify-center z-10">
            <div className="text-center bg-white dark:bg-warm-gray-800 rounded-lg px-6 py-4 shadow-lg border border-warm-gray-200 dark:border-warm-gray-700">
              <p className="text-warm-gray-700 dark:text-warm-gray-300 font-medium mb-2">Poll is paused</p>
              <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Click play to resume</p>
            </div>
          </div>
        )}
        
        {pollData.question ? (
          <div className="mt-4 flex flex-col h-full">
            <h3 className="text-lg font-medium text-warm-gray-800 dark:text-warm-gray-200 mb-4">
              {pollData.question}
            </h3>
            
            <div className={`space-y-3 ${pollData.options.length > 6 ? 'overflow-y-auto pr-2 max-h-[400px]' : ''} flex-1`}>
              {pollData.options.map((option, index) => {
                const color = getPollColor(index);
                return (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-warm-gray-700 dark:text-warm-gray-300">{option}</span>
                      <span className="text-warm-gray-500 dark:text-warm-gray-400">
                        {results.votes[index] || 0} votes
                      </span>
                    </div>
                    <div className="h-6 bg-warm-gray-200 dark:bg-warm-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${color.progress} ${color.progressDark} transition-all duration-500`}
                        style={{
                          width: `${results.totalVotes > 0 ? ((results.votes[index] || 0) / results.totalVotes) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-warm-gray-500 dark:text-warm-gray-400">
            Click settings to create your poll
          </div>
        )}
      </div>
      
      {/* Connection status overlays */}
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
    </div>
  );
}

// Export wrapped component to ensure WidgetProvider is available
const PollWithProvider = (props: PollProps) => {
  return (
    <WidgetProvider {...props}>
      <Poll {...props} />
    </WidgetProvider>
  );
};

export default PollWithProvider;