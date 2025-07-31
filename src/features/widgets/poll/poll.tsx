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

// Create a context for poll-specific state and actions
interface PollContextType {
  pollData: PollData;
  results: PollResults;
  updatePoll: (data: Partial<PollData>) => void;
  toggleActive: () => void;
  openSettings: () => void;
}

const PollContext = createContext<PollContextType | undefined>(undefined);

export const usePollContext = () => {
  const context = useContext(PollContext);
  if (!context) {
    throw new Error('usePollContext must be used within PollProvider');
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

// Poll Provider component
interface PollProviderProps extends PollProps {
  children: React.ReactNode;
}

const PollProvider: React.FC<PollProviderProps> = ({ widgetId, savedState, onStateChange, children }) => {
  const { session, isRoomActive } = useNetworkedWidgetContext();
  const { showModal, hideModal } = useModal();
  const [pollData, setPollData] = useState<PollData>({
    question: 'What is the question?',
    options: ['A', 'B'],
    isActive: false
  });
  const [results, setResults] = useState<PollResults>({
    votes: {},
    totalVotes: 0,
    participantCount: 0
  });

  // Load saved state
  useEffect(() => {
    if (savedState) {
      setPollData(savedState.pollData || {
        question: 'What is the question?',
        options: ['A', 'B'],
        isActive: false
      });
      setResults(savedState.results || {
        votes: {},
        totalVotes: 0,
        participantCount: 0
      });
    }
  }, [savedState]);

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
    'poll:stateChanged': (data: { isActive: boolean; widgetId?: string }) => {
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        setPollData(prev => ({ ...prev, isActive: data.isActive }));
      }
    }
  }), [session.participantCount, widgetId]);

  const { emitWidgetEvent, toggleActive, hasJoinedRoom } = useWidgetSocket({
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

  const updatePoll = useCallback((data: Partial<PollData>) => {
    const newPollData = { ...pollData, ...data };
    setPollData(newPollData);
    
    if (isRoomActive) {
      emitWidgetEvent('update', { pollData: newPollData });
    }
  }, [pollData, isRoomActive, emitWidgetEvent]);

  const handleToggleActive = useCallback(() => {
    if (!pollData.question || pollData.options.filter(o => o).length < 2) {
      return;
    }
    toggleActive(!pollData.isActive);
  }, [pollData, toggleActive]);

  const openSettings = useCallback(() => {
    showModal({
      title: 'Poll Settings',
      content: (
        <PollSettings 
          onSave={(data) => {
            updatePoll(data);
            hideModal();
          }}
          onClose={hideModal}
        />
      ),
      className: 'bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-2xl'
    });
  }, [showModal, hideModal, updatePoll]);

  // Send poll data to server when room becomes active
  useEffect(() => {
    if (isRoomActive && pollData.question && pollData.options.length > 0) {
      emitWidgetEvent('update', { pollData });
    }
  }, [isRoomActive, pollData, emitWidgetEvent]);

  useEffect(() => {
    onStateChange?.({
      pollData,
      results
    });
  }, [onStateChange, pollData, results]);

  const contextValue = useMemo(() => ({
    pollData,
    results,
    updatePoll,
    toggleActive: handleToggleActive,
    openSettings
  }), [pollData, results, updatePoll, handleToggleActive, openSettings]);

  return (
    <PollContext.Provider value={contextValue}>
      {children}
    </PollContext.Provider>
  );
};

function PollHeaderControls() {
  const { pollData, toggleActive, openSettings } = usePollContext();
  const { session, isRoomActive } = useNetworkedWidgetContext();

  return (
    <>
      <button
        onClick={toggleActive}
        disabled={!session.isConnected || !pollData.question || pollData.options.every(opt => !opt)}
        className={`p-2 rounded transition-colors ${
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
    </>
  );
}

function PollContent() {
  const { widgetId } = useWidget();
  const { pollData, results, toggleActive, openSettings } = usePollContext();
  const { session, isRoomActive } = useNetworkedWidgetContext();

  return (
    <>
      {/* Vote count */}
      <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-1">
        {results.totalVotes} vote{results.totalVotes !== 1 ? 's' : ''}
      </div>

      {/* Poll content */}
      <div className="flex-1 flex flex-col relative">
        {/* Paused overlay */}
        {!pollData.isActive && isRoomActive && session.isConnected && (
          <div className="absolute inset-0 bg-white/60 dark:bg-warm-gray-800/60 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-10">
            <div className="text-center bg-white/90 dark:bg-warm-gray-800/90 rounded-lg px-6 py-4 shadow-lg">
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
                        className={`h-full ${color.progress} transition-all duration-300`}
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
  return (
    <WidgetProvider widgetId={widgetId} savedState={savedState} onStateChange={onStateChange}>
      <NetworkedWidgetWrapperV2
        roomType="poll"
        title="Poll"
        description="Create interactive polls for your students"
        icon={FaChartColumn}
        // onRoomCreated and onRoomClosed will be handled by PollProvider
        headerChildren={(networkedState) => (
          <PollProvider widgetId={widgetId} savedState={savedState} onStateChange={onStateChange}>
            <PollHeaderControls />
          </PollProvider>
        )}
      >
        {(networkedState) => (
          <PollProvider widgetId={widgetId} savedState={savedState} onStateChange={onStateChange}>
            <PollContent />
          </PollProvider>
        )}
      </NetworkedWidgetWrapperV2>
    </WidgetProvider>
  );
}

export default Poll;