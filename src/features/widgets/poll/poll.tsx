import React, { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from 'react';
import { useModal } from '../../../contexts/ModalContext';
import { WidgetProvider } from '../../../contexts/WidgetContext';
import { NetworkedWidgetWrapperV2, useNetworkedWidgetContext } from '../shared/NetworkedWidgetWrapperV2';
import PollSettings from './PollSettings';
import { FaPlay, FaPause, FaChartColumn, FaGear } from 'react-icons/fa6';
import { getPollColor } from '../../../shared/constants/pollColors';
import { useWidgetSocket } from '../shared/hooks';
import { useWidget } from '../../../contexts/WidgetContext';
import { useWidgetState } from '../shared/hooks/useWidgetState';

interface PollProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

// Removed PollContext - using SharedPollContext instead

export const usePollContext = () => {
  const context = useContext(SharedPollContext);
  if (!context) {
    throw new Error('usePollContext must be used within SharedPollContext');
  }
  return context;
};

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

// Removed PollProvider component - all functionality moved to PollSocketManager

// Removed PollHeaderControls - moved inline to headerChildren

function PollPlayPauseButton() {
  const { pollData, toggleActive } = usePollContext();
  const { session } = useNetworkedWidgetContext();
  
  return (
    <button
      onClick={toggleActive}
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
  );
}

function PollSettingsButton() {
  const { openSettings } = usePollContext();
  
  return (
    <button
      onClick={openSettings}
      className="p-2 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors"
      title="Settings"
    >
      <FaGear className="text-base" />
    </button>
  );
}

// Create a shared state context for Poll instances
interface SharedPollState {
  pollData: PollData;
  results: PollResults;
  setPollData: (data: PollData | ((prev: PollData) => PollData)) => void;
  setResults: (data: PollResults | ((prev: PollResults) => PollResults)) => void;
  toggleActive: (newState: boolean) => void;
  emitWidgetEvent: (eventName: string, data: any) => void;
  updatePoll: (data: Partial<PollData>) => void;
  openSettings: () => void;
}

const SharedPollContext = React.createContext<SharedPollState | null>(null);

// Create a singleton state manager
let pollSocketInstance: any = null;

// Custom hook that manages all socket logic
function usePollSocket({ widgetId, pollData, setPollData, results, setResults, isProvider = false }: { 
  widgetId?: string; 
  pollData: PollData;
  setPollData: React.Dispatch<React.SetStateAction<PollData>>;
  results: PollResults;
  setResults: React.Dispatch<React.SetStateAction<PollResults>>;
  isProvider?: boolean;
}) {
  const { session, isRoomActive } = useNetworkedWidgetContext();
  const { showModal, hideModal } = useModal();
  
  // Socket event handlers
  const socketEvents = useMemo(() => ({
    'poll:updated': (data: any) => {
      setPollData(data);
    },
    'poll:dataUpdate': (data: any) => {
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
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        setResults({
          votes: data.votes,
          totalVotes: data.totalVotes,
          participantCount: session.participantCount
        });
      }
    },
    // Only listen to the unified session:widgetStateChanged event
    'session:widgetStateChanged': (data: { roomType: string; widgetId?: string; isActive: boolean }) => {
      console.log('[Poll] Received session:widgetStateChanged:', data, 'for widget:', widgetId);
      if (data.roomType === 'poll' && (data.widgetId === widgetId || (!data.widgetId && !widgetId))) {
        setPollData(prev => {
          // Only update if the value actually changed
          if (prev.isActive !== data.isActive) {
            console.log('[Poll] Updating isActive from', prev.isActive, 'to', data.isActive);
            return { ...prev, isActive: data.isActive };
          }
          return prev; // No change needed
        });
      }
    }
  }), [session.participantCount, widgetId, setPollData, setResults]);

  // Only create socket connection if this is the provider instance
  const { emitWidgetEvent, toggleActive, hasJoinedRoom } = useWidgetSocket({
    socket: session.socket,
    sessionCode: session.sessionCode,
    roomType: 'poll',
    widgetId,
    isActive: pollData.isActive,
    isRoomActive,
    events: isProvider ? socketEvents : {}, // Only register events in provider
    startEvent: 'session:poll:start',
    stopEvent: 'session:poll:stop'
  });

  const updatePoll = useCallback((data: Partial<PollData>) => {
    const newPollData = { ...pollData, ...data };
    setPollData(newPollData);
    
    if (isRoomActive) {
      emitWidgetEvent('update', { pollData: newPollData });
    }
  }, [pollData, isRoomActive, emitWidgetEvent, setPollData]);

  // Add a flag to prevent rapid toggling
  const isTogglingRef = useRef(false);
  
  const handleToggleActive = useCallback(() => {
    if (isTogglingRef.current) {
      console.log('[Poll] Toggle already in progress, ignoring');
      return;
    }
    
    console.log('[Poll] handleToggleActive called, current state:', pollData.isActive);
    if (!pollData.question || pollData.options.filter(o => o).length < 2) {
      console.log('[Poll] Cannot toggle - invalid question or options');
      return;
    }
    
    isTogglingRef.current = true;
    const newState = !pollData.isActive;
    console.log('[Poll] Toggling active state to:', newState);
    toggleActive(newState);
    
    // Reset flag after a short delay
    setTimeout(() => {
      isTogglingRef.current = false;
    }, 500);
  }, [pollData, toggleActive]);

  const openSettings = useCallback(() => {
    showModal({
      title: 'Poll Settings',
      content: <PollSettings onClose={hideModal} />,
      onClose: hideModal
    });
  }, [showModal, hideModal]);

  // Send poll data to server when room becomes active
  useEffect(() => {
    if (isRoomActive && pollData.question && pollData.options.length > 0) {
      emitWidgetEvent('update', { pollData });
    }
  }, [isRoomActive, pollData, emitWidgetEvent]);

  return {
    toggleActive: handleToggleActive,
    updatePoll,
    openSettings,
    emitWidgetEvent
  };
}

// Component that provides poll context inside NetworkedWidgetWrapperV2
function PollProvider({ widgetId, pollData, setPollData, results, setResults, children, isProvider = false }: {
  widgetId?: string;
  pollData: PollData;
  setPollData: React.Dispatch<React.SetStateAction<PollData>>;
  results: PollResults;
  setResults: React.Dispatch<React.SetStateAction<PollResults>>;
  children: React.ReactNode;
  isProvider?: boolean;
}) {
  // Use the custom hook to manage socket logic
  const { toggleActive, updatePoll, openSettings, emitWidgetEvent } = usePollSocket({
    widgetId,
    pollData,
    setPollData,
    results,
    setResults,
    isProvider
  });

  const value = useMemo(() => ({
    pollData,
    results,
    setPollData,
    setResults,
    toggleActive,
    emitWidgetEvent,
    updatePoll,
    openSettings
  }), [pollData, results, setPollData, setResults, toggleActive, emitWidgetEvent, updatePoll, openSettings]);

  return (
    <SharedPollContext.Provider value={value}>
      {children}
    </SharedPollContext.Provider>
  );
}

// Removed PollRefSetter - no longer needed

// Component that only renders the poll UI without socket management
function PollUI({ widgetId }: { widgetId?: string }) {
  const { widgetId: ctxWidgetId } = useWidget();
  const { pollData, results } = usePollContext();
  const { session, isRoomActive } = useNetworkedWidgetContext();
  const [showOverlay, setShowOverlay] = useState(!pollData.isActive);
  
  // Delay showing/hiding overlay to prevent flicker
  useEffect(() => {
    if (!pollData.isActive) {
      // Show overlay immediately when pausing
      setShowOverlay(true);
    } else {
      // Hide overlay with a small delay when playing
      const timer = setTimeout(() => setShowOverlay(false), 50);
      return () => clearTimeout(timer);
    }
  }, [pollData.isActive]);

  return (
    <>
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
    </>
  );
}

function Poll({ widgetId, savedState, onStateChange }: PollProps) {
  // Shared state that both instances will use
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
  
  // Save state changes
  useEffect(() => {
    onStateChange?.({
      pollData,
      results
    });
  }, [onStateChange, pollData, results]);
  
  return (
    <WidgetProvider widgetId={widgetId} savedState={savedState} onStateChange={onStateChange}>
      <NetworkedWidgetWrapperV2
        roomType="poll"
        title="Poll"
        description="Create interactive polls for your students"
        icon={FaChartColumn}
        headerChildren={(networkedState) => (
          <PollProvider
            widgetId={widgetId}
            pollData={pollData}
            setPollData={setPollData}
            results={results}
            setResults={setResults}
          >
            <div className="flex gap-2">
              <PollPlayPauseButton />
              <PollSettingsButton />
            </div>
          </PollProvider>
        )}
      >
        {(networkedState) => (
          <PollProvider
            widgetId={widgetId}
            pollData={pollData}
            setPollData={setPollData}
            results={results}
            setResults={setResults}
            isProvider={true} // This is the main provider
          >
            <PollUI widgetId={widgetId} />
          </PollProvider>
        )}
      </NetworkedWidgetWrapperV2>
    </WidgetProvider>
  );
}

export default Poll;