import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaPlay, FaPause, FaChartColumn, FaGear, FaArrowRotateLeft } from 'react-icons/fa6';
import { useModal } from '../../../contexts/ModalContext';
import { WidgetProvider } from '../../../contexts/WidgetContext';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { NetworkedWidgetHeader } from '../shared/NetworkedWidgetHeader';
import { useSocketEvents } from '../../session/hooks/useSocketEvents';
import { useSession } from '../../../contexts/SessionContext';
import { getPollColor } from '../../../shared/constants/pollColors';
import PollSettings from './PollSettings';
import { getRandomPollQuestion } from './pollQuestions';
import { useWidget } from '../../../shared/hooks/useWidget';
import { debug } from '../../../shared/utils/debug';

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
    session,
    recoveryData
  } = useNetworkedWidget({
    widgetId,
    roomType: 'poll',
    savedState,
    onStateChange
  });
  
  // Get unified session for additional methods
  const unifiedSession = useSession();
  
  // Socket event handlers
  const socketEvents = useMemo(() => ({
    'poll:dataUpdate': (data: any) => {
      debug('[Poll] Received poll:dataUpdate:', data, 'for widget:', widgetId);
      if (data.widgetId === widgetId) {
        debug('[Poll] Processing dataUpdate for our widget');
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
      debug('[Poll] Received poll:voteUpdate:', data, 'for widget:', widgetId);
      if (data.widgetId === widgetId) {
        debug('[Poll] Updating vote results');
        setResults(prevResults => ({
          ...prevResults,
          votes: data.votes,
          totalVotes: data.totalVotes,
        }));
      }
    },
    'session:widgetStateChanged': (data: { roomType: string; widgetId?: string; isActive: boolean }) => {
      debug('[Poll] Received session:widgetStateChanged:', data, 'for widget:', widgetId);
      if (data.roomType === 'poll' && (data.widgetId === widgetId || (!data.widgetId && !widgetId))) {
        debug('[Poll] Updating widget active state to:', data.isActive);
        setIsWidgetActive(data.isActive);
      }
    }
  }), [widgetId]);
  
  // Use socket events hook for automatic event management
  const { emit } = useSocketEvents({
    events: socketEvents,
    isActive: hasRoom // Only listen to events when room exists
  });
  
  // Toggle active state using unified session
  const toggleActive = useCallback((newState: boolean) => {
    if (!widgetId || !hasRoom) return;
    unifiedSession.updateRoomState('poll', widgetId, newState);
  }, [widgetId, hasRoom, unifiedSession]);
  
  // Reset votes
  const reset = useCallback(() => {
    if (!widgetId || !hasRoom) return;
    emit('session:reset', {
      sessionCode: session.sessionCode,
      widgetId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);
  
  // Actions
  const updatePoll = useCallback((data: Partial<PollData>) => {
    const newPollData = { ...pollData, ...data };
    setPollData(newPollData);
    
    if (hasRoom) {
      emit('session:poll:update', {
        sessionCode: session.sessionCode,
        widgetId,
        pollData: newPollData
      });
    }
  }, [pollData, hasRoom, emit, session.sessionCode, widgetId]);
  
  const handleToggleActive = useCallback(() => {
    debug('[Poll] handleToggleActive called, current state:', isWidgetActive, 'hasRoom:', hasRoom);
    
    // Check if we have a room first
    if (!hasRoom) {
      debug('[Poll] Cannot toggle - no room exists');
      return;
    }
    
    if (!pollData.question || pollData.options.filter(o => o).length < 2) {
      debug('[Poll] Cannot toggle - invalid question or options');
      return;
    }
    
    const newState = !isWidgetActive;
    debug('[Poll] Toggling active state to:', newState);
    
    // Use the toggleActive function from useActiveState hook
    toggleActive(newState);
    
    // Always send the poll data when toggling state
    debug('[Poll] Sending poll data with state change');
    emit('session:poll:update', {
      sessionCode: session.sessionCode,
      widgetId,
      pollData
    });
  }, [pollData, isWidgetActive, hasRoom, toggleActive, emit, session.sessionCode, widgetId]);
  
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
            
            debug(`[Poll] Auto-resizing after settings change to height: ${calculatedHeight} for ${data.options.length} options`);
            resize({ width: widget.size.width, height: calculatedHeight });
          }
        }} 
        onClose={hideModal} 
      />,
      onClose: hideModal
    });
  }, [showModal, hideModal, updatePoll, pollData]);
  
  const resetVotes = useCallback(() => {
    if (!hasRoom) return;
    
    debug('[Poll] Resetting votes');
    reset();
    
    // Clear local results immediately for responsive UI
    setResults({
      votes: {},
      totalVotes: 0,
      participantCount: 0
    });
  }, [hasRoom, reset]);
  
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
      
      debug(`[Poll] Auto-resizing new widget to height: ${calculatedHeight} for ${pollData.options.length} options`);
      resize({ width: widget.size.width, height: calculatedHeight });
      setHasAutoResized(true);
    }
  }, [widget, resize, widgetId, savedState, hasAutoResized, pollData.options.length]);
  
  
  // Cleanup handled by workspace when widget is deleted
  // No need to handle it here as it can cause issues with re-renders
  
  useEffect(() => {
    onStateChange?.({
      pollData,
      results
    });
  }, [onStateChange, pollData, results]);
  
  // Handle recovery data from SessionContext
  useEffect(() => {
    if (recoveryData && recoveryData.roomData) {
      debug('[Poll] Recovery data available:', recoveryData);
      
      // Apply recovered widget state
      if (recoveryData.isActive !== undefined) {
        setIsWidgetActive(recoveryData.isActive);
      }
      
      // Only apply recovered poll data if it has meaningful content
      // (not empty question/options which indicates a new widget)
      if (recoveryData.roomData.pollData && 
          recoveryData.roomData.pollData.question && 
          recoveryData.roomData.pollData.options && 
          recoveryData.roomData.pollData.options.length > 0) {
        debug('[Poll] Applying recovered poll data');
        setPollData(recoveryData.roomData.pollData);
      } else {
        debug('[Poll] Recovery data has empty poll data, keeping random question');
      }
      
      // Apply recovered results if available
      if (recoveryData.roomData.results) {
        setResults(recoveryData.roomData.results);
      }
    }
  }, [recoveryData]);

  // Handle room establishment - send data for new rooms only
  useEffect(() => {
    if (hasRoom && session.socket && session.sessionCode) {
      // Small delay to ensure room is fully established on server
      const timer = setTimeout(() => {
        // For new rooms (no recovery data), send our local data if we have any
        if (!recoveryData && pollData.question && pollData.options.length > 0) {
          debug('[Poll] New room detected, sending initial poll data');
          emit('session:poll:update', {
            sessionCode: session.sessionCode,
            widgetId,
            pollData
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasRoom]); // Only trigger when hasRoom changes
  
  // Empty state - show when no room exists
  if (!hasRoom) {
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
        {!isWidgetActive && session.isConnected && (
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