import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaPlay, FaPause, FaChartColumn, FaGear } from 'react-icons/fa6';
import { useModal } from '../../../contexts/ModalContext';
import { WidgetProvider } from '../../../contexts/WidgetContext';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { NetworkedWidgetHeader } from '../shared/NetworkedWidgetHeader';
import { useWidgetSocket } from '../shared/hooks';
import { getPollColor } from '../../../shared/constants/pollColors';
import PollSettings from './PollSettings';

interface PollProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface PollData {
  question: string;
  options: string[];
  isActive: boolean;
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
  const [pollData, setPollData] = useState<PollData>(() => savedState?.pollData || {
    question: 'What is the question?',
    options: ['A', 'B'],
    isActive: false
  });
  
  const [results, setResults] = useState<PollResults>(() => savedState?.results || {
    votes: {},
    totalVotes: 0,
    participantCount: 0
  });
  
  const [showOverlay, setShowOverlay] = useState(!pollData.isActive);
  
  // Hooks
  const { showModal, hideModal } = useModal();
  
  // Networked widget hook
  const {
    isRoomActive,
    isStarting,
    error,
    handleStart,
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
      console.log('[Poll] Received poll:dataUpdate:', data);
      if (data.pollData) {
        if (data.pollData.question || data.pollData.options?.length > 0) {
          setPollData(data.pollData);
        } else {
          setPollData(prev => ({ ...prev, isActive: data.pollData.isActive }));
        }
      }
      if (data.results) {
        setResults({
          votes: data.results.votes || {},
          totalVotes: data.results.totalVotes || 0,
          participantCount: data.results.participantCount || 0
        });
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
        setPollData(prev => {
          if (prev.isActive !== data.isActive) {
            console.log('[Poll] Updating isActive from', prev.isActive, 'to', data.isActive);
            return { ...prev, isActive: data.isActive };
          }
          return prev;
        });
      }
    }
  }), [widgetId]);
  
  // Widget socket hook
  const { emitWidgetEvent, toggleActive } = useWidgetSocket({
    socket: session.socket,
    sessionCode: session.sessionCode,
    roomType: 'poll',
    widgetId,
    isActive: pollData.isActive,
    isRoomActive,
    events: socketEvents,
    startEvent: 'session:poll:start',
    stopEvent: 'session:poll:stop'
  });
  
  // Actions
  const updatePoll = useCallback((data: Partial<PollData>) => {
    const newPollData = { ...pollData, ...data };
    setPollData(newPollData);
    
    if (isRoomActive) {
      emitWidgetEvent('update', { pollData: newPollData });
    }
  }, [pollData, isRoomActive, emitWidgetEvent]);
  
  const handleToggleActive = useCallback(() => {
    console.log('[Poll] handleToggleActive called, current state:', pollData.isActive);
    if (!pollData.question || pollData.options.filter(o => o).length < 2) {
      console.log('[Poll] Cannot toggle - invalid question or options');
      return;
    }
    
    const newState = !pollData.isActive;
    console.log('[Poll] Toggling active state to:', newState);
    toggleActive(newState);
    
    // When activating, also send the poll data
    if (newState && isRoomActive) {
      console.log('[Poll] Sending poll data with activation');
      emitWidgetEvent('update', { pollData: { ...pollData, isActive: newState } });
    }
  }, [pollData, toggleActive, isRoomActive, emitWidgetEvent]);
  
  const openSettings = useCallback(() => {
    showModal({
      title: 'Poll Settings',
      content: <PollSettings onSave={(data) => {
        updatePoll(data);
        hideModal();
      }} onClose={hideModal} />,
      onClose: hideModal
    });
  }, [showModal, hideModal, updatePoll]);
  
  // Effects
  useEffect(() => {
    if (!pollData.isActive) {
      setShowOverlay(true);
    } else {
      const timer = setTimeout(() => setShowOverlay(false), 50);
      return () => clearTimeout(timer);
    }
  }, [pollData.isActive]);
  
  useEffect(() => {
    onStateChange?.({
      pollData,
      results
    });
  }, [onStateChange, pollData, results]);
  
  useEffect(() => {
    if (isRoomActive && pollData.question && pollData.options.length > 0) {
      emitWidgetEvent('update', { pollData });
    }
  }, [isRoomActive]); // Only on room activation
  
  // Empty state
  if (!isRoomActive || !session.sessionCode) {
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
        error={error}
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
              pollData.isActive 
                ? 'text-dusty-rose-600 hover:text-dusty-rose-700 dark:text-dusty-rose-400 dark:hover:text-dusty-rose-300 hover:bg-dusty-rose-100 dark:hover:bg-dusty-rose-900/20' 
                : 'text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 hover:bg-sage-100 dark:hover:bg-sage-900/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={pollData.isActive ? "Pause poll" : "Start poll"}
          >
            {pollData.isActive ? <FaPause className="text-base" /> : <FaPlay className="text-base" />}
          </button>
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
        {showOverlay && isRoomActive && session.isConnected && (
          <div className="absolute inset-0 bg-white/80 dark:bg-warm-gray-800/80 rounded-lg flex items-center justify-center z-10">
            <div className="text-center bg-white dark:bg-warm-gray-800 rounded-lg px-6 py-4 shadow-lg border border-warm-gray-200 dark:border-warm-gray-700">
              <p className="text-warm-gray-700 dark:text-warm-gray-300 font-medium mb-2">Poll is paused</p>
              <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Click play to resume</p>
            </div>
          </div>
        )}
        
        {pollData.question ? (
          <div className="mt-4">
            <h3 className="text-lg font-medium text-warm-gray-800 dark:text-warm-gray-200 mb-4">
              {pollData.question}
            </h3>
            
            <div className="space-y-3">
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
                        className={`h-full ${color.progress} transition-all duration-500`}
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