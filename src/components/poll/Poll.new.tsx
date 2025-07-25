// Refactored Poll widget with proper TypeScript types

import React, { useState, useEffect, useCallback } from 'react';
import { useModal } from '../../contexts/ModalContext';
import { NetworkedWidgetWrapper } from '../shared/NetworkedWidgetWrapper';
import PollSettings from './PollSettings';
import { FaPlay, FaPause, FaChartColumn, FaGear } from 'react-icons/fa6';
import { PollProps, PollState } from '../../types/widget-types';

const defaultPollState: PollState = {
  question: 'What is the question?',
  options: [
    { id: '1', text: 'Option A', votes: 0 },
    { id: '2', text: 'Option B', votes: 0 }
  ],
  isActive: false,
  allowMultiple: false,
  showResults: true,
  totalVotes: 0,
  participants: new Set()
};

const Poll: React.FC<PollProps> = ({ widgetId, savedState, onStateChange }) => {
  const [pollState, setPollState] = useState<PollState>(
    savedState || defaultPollState
  );
  
  const { showModal, hideModal } = useModal();
  const [sessionRef, setSessionRef] = useState<any>(null);
  const [isRoomActiveRef, setIsRoomActiveRef] = useState(false);

  // Save state changes
  useEffect(() => {
    onStateChange?.(pollState);
  }, [pollState, onStateChange]);

  const openSettings = () => {
    showModal({
      title: 'Poll Settings',
      content: (
        <PollSettings 
          pollData={{
            question: pollState.question,
            options: pollState.options.map(o => o.text),
            isActive: pollState.isActive
          }}
          onSave={(data) => {
            setPollState(prev => ({
              ...prev,
              question: data.question,
              options: data.options.map((text, index) => ({
                id: String(index + 1),
                text,
                votes: prev.options[index]?.votes || 0
              })),
              isActive: data.isActive
            }));
            hideModal();
          }}
          onClose={hideModal}
        />
      ),
      className: 'bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-2xl'
    });
  };

  const handleToggleActive = () => {
    if (!sessionRef || !isRoomActiveRef) return;
    
    const newState = { ...pollState, isActive: !pollState.isActive };
    setPollState(newState);
    
    if (sessionRef.socket) {
      sessionRef.socket.emit('session:poll:update', {
        sessionCode: sessionRef.sessionCode,
        widgetId,
        pollData: {
          question: newState.question,
          options: newState.options.map(o => o.text),
          isActive: newState.isActive
        }
      });
    }
  };

  const handleStateChange = useCallback((state: any) => {
    onStateChange?.({
      ...state,
      pollState
    });
  }, [onStateChange, pollState]);

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
        setPollState(prev => ({ ...prev, isActive: false }));
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
            disabled={!pollState.question || pollState.options.length < 2 || !isRoomActiveRef}
            className={`p-1.5 rounded transition-colors duration-200 ${
              pollState.isActive 
                ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white' 
                : 'bg-sage-500 hover:bg-sage-600 text-white disabled:bg-warm-gray-400 disabled:cursor-not-allowed'
            }`}
            title={pollState.isActive ? "Pause poll" : "Resume poll"}
          >
            {pollState.isActive ? <FaPause /> : <FaPlay />}
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

        // Setup socket listeners
        useEffect(() => {
          if (!session.socket) return;

          const handlePollDataUpdate = (data: any) => {
            if (data.pollData) {
              setPollState(prev => ({
                ...prev,
                question: data.pollData.question,
                options: data.pollData.options.map((text: string, index: number) => ({
                  id: String(index + 1),
                  text,
                  votes: prev.options[index]?.votes || 0
                })),
                isActive: data.pollData.isActive
              }));
            }
            if (data.results) {
              setPollState(prev => ({
                ...prev,
                totalVotes: data.results.totalVotes || 0,
                participants: new Set(data.results.participants || [])
              }));
            }
          };

          const handleVoteUpdate = (data: any) => {
            setPollState(prev => ({
              ...prev,
              options: prev.options.map((option, index) => ({
                ...option,
                votes: data.votes[index] || 0
              })),
              totalVotes: data.totalVotes,
              participants: new Set(data.participants || [])
            }));
          };

          session.socket.on('poll:dataUpdate', handlePollDataUpdate);
          session.socket.on('poll:voteUpdate', handleVoteUpdate);

          return () => {
            session.socket?.off('poll:dataUpdate', handlePollDataUpdate);
            session.socket?.off('poll:voteUpdate', handleVoteUpdate);
          };
        }, [session.socket]);

        const totalVotes = pollState.options.reduce((sum, opt) => sum + opt.votes, 0);

        return (
          <>
            {/* Vote count */}
            <div className="flex justify-between items-center mb-1">
              <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Poll content */}
            <div className="flex-1 flex flex-col">
              {pollState.question ? (
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-warm-gray-800 dark:text-warm-gray-200 mb-4">
                    {pollState.question}
                  </h3>
                  
                  <div className="space-y-3">
                    {pollState.options.map((option) => {
                      const percentage = totalVotes > 0 
                        ? (option.votes / totalVotes) * 100 
                        : 0;
                        
                      return (
                        <div key={option.id} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-warm-gray-700 dark:text-warm-gray-300">
                                {option.text}
                              </span>
                              <span className="text-warm-gray-500 dark:text-warm-gray-400">
                                {option.votes} votes
                              </span>
                            </div>
                            <div className="h-6 bg-warm-gray-200 dark:bg-warm-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-sage-500 transition-all duration-300"
                                style={{ width: `${percentage}%` }}
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
};

export default Poll;