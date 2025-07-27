import React, { useState, useEffect, useCallback } from 'react';
import { useModal } from '../../../contexts/ModalContext';
import { NetworkedWidgetWrapper } from '../shared/NetworkedWidgetWrapper';
import PollSettings from './PollSettings';
import { FaPlay, FaPause, FaChartColumn, FaGear } from 'react-icons/fa6';
import { getPollColor } from '../../../utils/pollColors';

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

  const [sessionRef, setSessionRef] = useState<any>(null);
  const [isRoomActiveRef, setIsRoomActiveRef] = useState(false);

  const handleToggleActive = () => {
    if (!sessionRef || !isRoomActiveRef) return;
    
    const newIsActive = !pollData.isActive;
    const newPollData = { ...pollData, isActive: newIsActive };
    setPollData(newPollData);
    
    if (sessionRef.socket) {
      sessionRef.socket.emit('session:poll:update', {
        sessionCode: sessionRef.sessionCode,
        widgetId,
        pollData: newPollData
      });
    }
  };

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
      headerChildren={
        <>
          <button
            onClick={openSettings}
            className="p-1.5 text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors"
            title="Settings"
          >
            <FaGear />
          </button>
          <button
            onClick={handleToggleActive}
            disabled={!pollData.question || pollData.options.filter(o => o).length < 2 || !isRoomActiveRef}
            className={`p-1.5 rounded transition-colors duration-200 ${
              pollData.isActive 
                ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white' 
                : 'bg-sage-500 hover:bg-sage-600 text-white disabled:bg-warm-gray-400 disabled:cursor-not-allowed'
            }`}
            title={pollData.isActive ? "Pause poll" : "Resume poll"}
          >
            {pollData.isActive ? <FaPause /> : <FaPlay />}
          </button>
        </>
      }
    >
      {({ session, isRoomActive }) => {
        // Update refs for header buttons
        useEffect(() => {
          setSessionRef(session);
          setIsRoomActiveRef(isRoomActive);
        }, [session, isRoomActive]);

        // Join the widget-specific room
        useEffect(() => {
          if (!session.socket || !session.sessionCode || !isRoomActive) return;
          
          const roomId = widgetId ? `poll:${widgetId}` : 'poll';
          
          // Join the room for this specific widget instance
          session.socket.emit('session:joinRoom', { 
            sessionCode: session.sessionCode,
            roomType: 'poll',
            widgetId 
          });
          
          return () => {
            session.socket?.emit('session:leaveRoom', { 
              sessionCode: session.sessionCode,
              roomType: 'poll',
              widgetId 
            });
          };
        }, [session.socket, session.sessionCode, isRoomActive, widgetId]);

        // Setup socket listeners
        useEffect(() => {
          if (!session.socket) return;

          const handlePollUpdate = (data: any) => {
            setPollData(data);
          };

          const handlePollDataUpdate = (data: any) => {
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
          };

          const handleVoteUpdate = (data: any) => {
            setResults({
              votes: data.votes,
              totalVotes: data.totalVotes,
              participantCount: session.participantCount
            });
          };

          // Listen to both legacy and new event names
          session.socket.on('poll:updated', handlePollUpdate);
          session.socket.on('poll:dataUpdate', handlePollDataUpdate);
          session.socket.on('poll:voteUpdate', handleVoteUpdate);

          return () => {
            session.socket?.off('poll:updated', handlePollUpdate);
            session.socket?.off('poll:dataUpdate', handlePollDataUpdate);
            session.socket?.off('poll:voteUpdate', handleVoteUpdate);
          };
        }, [session.socket, session.participantCount]);

        const updatePoll = (data: Partial<PollData>) => {
          const newPollData = { ...pollData, ...data };
          setPollData(newPollData);
          
          if (session.socket && isRoomActive) {
            session.socket.emit('session:poll:update', {
              sessionCode: session.sessionCode,
              widgetId,
              pollData: newPollData
            });
          }
        };

        const handleStop = () => {
          updatePoll({ isActive: false });
        };

        return (
          <>
            {/* Vote count */}
            <div className="flex justify-between items-center mb-1">
              <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                {results.totalVotes} vote{results.totalVotes !== 1 ? 's' : ''}
              </div>
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