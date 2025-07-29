import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useModal } from '../../../contexts/ModalContext';
import { NetworkedWidgetWrapper } from '../shared/NetworkedWidgetWrapper';
import PollSettings from './PollSettings';
import { FaPlay, FaPause, FaChartColumn, FaGear } from 'react-icons/fa6';
import { getPollColor } from '../../../utils/pollColors';
import { useWidgetSocket } from '../shared/hooks';

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

function Poll({ widgetId, savedState, onStateChange }: PollProps) {
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
  const toggleActiveRef = useRef<(() => void) | null>(null);
  
  const { showModal, hideModal } = useModal();
  

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


  const openSettings = () => {
    showModal({
      title: 'Poll Settings',
      content: (
        <PollSettings 
          pollData={pollData}
          onSave={(data) => {
            setPollData({ ...pollData, ...data });
            hideModal();
          }}
          onClose={hideModal}
        />
      ),
      className: 'bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-2xl'
    });
  };

  const handleStateChange = useCallback((state: any) => {
    onStateChange?.({
      ...state,
      pollData,
      results
    });
  }, [onStateChange, pollData, results]);


  return (
    <NetworkedWidgetWrapper
      widgetId={widgetId}
      savedState={savedState}
      onStateChange={handleStateChange}
      roomType="poll"
      title="Poll"
      description="Create interactive polls for your students"
      icon={FaChartColumn}
      onRoomClosed={() => {
        setPollData(prev => ({ ...prev, isActive: false }));
      }}
      headerChildren={({ session, isRoomActive }) => {
        if (!session || !isRoomActive) return (
          <button
            onClick={openSettings}
            className="p-1.5 text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors"
            title="Settings"
          >
            <FaGear />
          </button>
        );
        
        return (
          <>
            {toggleActiveRef.current && (
              <button
                onClick={toggleActiveRef.current}
                disabled={!pollData.question || pollData.options.filter(o => o).length < 2}
                className={`p-1.5 rounded transition-colors duration-200 ${
                  pollData.isActive 
                    ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white' 
                    : 'bg-sage-500 hover:bg-sage-600 text-white disabled:bg-warm-gray-400 disabled:cursor-not-allowed'
                }`}
                title={pollData.isActive ? "Pause poll" : "Resume poll"}
              >
                {pollData.isActive ? <FaPause /> : <FaPlay />}
              </button>
            )}
            <button
              onClick={openSettings}
              className="p-1.5 text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors"
              title="Settings"
            >
              <FaGear />
            </button>
          </>
        );
      }}
    >
      {({ session, isRoomActive }) => {
        // Socket event handlers
        const socketEvents = useMemo(() => ({
          'poll:updated': (data: any) => {
            setPollData(data);
          },
          'poll:dataUpdate': (data: any) => {
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
          },
          'poll:voteUpdate': (data: any) => {
            setResults({
              votes: data.votes,
              totalVotes: data.totalVotes,
              participantCount: session.participantCount
            });
          },
          'poll:stateChanged': (data: { isActive: boolean; widgetId?: string }) => {
            // Only handle state changes for this specific widget
            if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
              setPollData(prev => ({ ...prev, isActive: data.isActive }));
            }
          }
        }), [session.participantCount, widgetId]);

        // Use the new composite hook for socket management
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

        const updatePoll = useCallback((data: Partial<PollData>) => {
          const newPollData = { ...pollData, ...data };
          setPollData(newPollData);
          
          if (isRoomActive) {
            emitWidgetEvent('update', { pollData: newPollData });
          }
        }, [pollData, isRoomActive, emitWidgetEvent]);

        const handleStop = () => {
          updatePoll({ isActive: false });
        };

        const handleToggleActive = () => {
          // Validate poll data before toggling
          if (!pollData.question || pollData.options.filter(o => o).length < 2) {
            return;
          }
          
          // Use the standard toggleActive function
          toggleActive(!pollData.isActive);
        };

        // Store toggleActive in ref so header can access it
        useEffect(() => {
          toggleActiveRef.current = handleToggleActive;
        }, [handleToggleActive]);

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
      }}
    </NetworkedWidgetWrapper>
  );
}

export default Poll;