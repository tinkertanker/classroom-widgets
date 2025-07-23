import React, { useState, useEffect } from 'react';
import { useModal } from '../../contexts/ModalContext';
import { NetworkedWidgetWrapper } from '../shared/NetworkedWidgetWrapper';
import PollSettings from './PollSettings';
import { FaPlay, FaStop, FaChartColumn, FaGear } from 'react-icons/fa6';

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

  return (
    <NetworkedWidgetWrapper
      widgetId={widgetId}
      savedState={savedState}
      onStateChange={(state) => {
        onStateChange?.({
          ...state,
          pollData,
          results
        });
      }}
      roomType="poll"
      title="Poll"
      description="Create interactive polls for your students"
      icon={FaChartColumn}
      onRoomClosed={() => {
        setPollData(prev => ({ ...prev, isActive: false }));
      }}
      headerChildren={
        <button
          onClick={openSettings}
          className="p-1.5 text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors"
          title="Settings"
        >
          <FaGear />
        </button>
      }
    >
      {({ session, isRoomActive }) => {
        // Setup socket listeners
        useEffect(() => {
          if (!session.socket) return;

          const handlePollUpdate = (data: any) => {
            setPollData(data);
          };

          const handleVoteUpdate = (data: any) => {
            setResults({
              votes: data.votes,
              totalVotes: data.totalVotes,
              participantCount: session.participantCount
            });
          };

          session.socket.on('poll:updated', handlePollUpdate);
          session.socket.on('poll:voteUpdate', handleVoteUpdate);

          return () => {
            session.socket?.off('poll:updated', handlePollUpdate);
            session.socket?.off('poll:voteUpdate', handleVoteUpdate);
          };
        }, [session.socket, session.participantCount]);

        const updatePoll = (data: Partial<PollData>) => {
          const newPollData = { ...pollData, ...data };
          setPollData(newPollData);
          
          if (session.socket && isRoomActive) {
            session.socket.emit('session:poll:update', {
              sessionCode: session.sessionCode,
              pollData: newPollData
            });
          }
        };

        const handleStop = () => {
          updatePoll({ isActive: false });
        };

        return (
          <>
            {/* Poll content */}
            <div className="flex-1 flex flex-col">
              {pollData.question ? (
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-warm-gray-800 dark:text-warm-gray-200 mb-4">
                    {pollData.question}
                  </h3>
                  
                  <div className="space-y-3">
                    {pollData.options.map((option, index) => (
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
                              className="h-full bg-sage-500 transition-all duration-300"
                              style={{
                                width: `${results.totalVotes > 0 ? ((results.votes[index] || 0) / results.totalVotes) * 100 : 0}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 text-sm text-warm-gray-600 dark:text-warm-gray-400">
                    Total votes: {results.totalVotes}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-warm-gray-500 dark:text-warm-gray-400">
                  Click settings to create your poll
                </div>
              )}
            </div>

            {/* Control button */}
            <div className="mt-4 flex justify-center">
              <button
                onClick={pollData.isActive ? handleStop : () => updatePoll({ isActive: true })}
                disabled={!pollData.question || pollData.options.filter(o => o).length < 2}
                className={`px-3 py-1.5 text-white text-sm rounded transition-colors duration-200 flex items-center gap-1.5 ${
                  pollData.isActive
                    ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600'
                    : 'bg-sage-500 hover:bg-sage-600 disabled:bg-warm-gray-400 disabled:cursor-not-allowed'
                }`}
              >
                {pollData.isActive ? (
                  <>
                    <FaStop className="text-xs" />
                    Stop Poll
                  </>
                ) : (
                  <>
                    <FaPlay className="text-xs" />
                    Start Poll
                  </>
                )}
              </button>
            </div>
          </>
        );
      }}
    </NetworkedWidgetWrapper>
  );
}

export default Poll;