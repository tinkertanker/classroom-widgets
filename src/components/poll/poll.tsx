import React, { useState } from 'react';
import { useModal } from '../../contexts/ModalContext';
import { useNetworkedWidget } from '../../hooks/useNetworkedWidget';
import { NetworkedWidgetHeader } from '../shared/NetworkedWidgetHeader';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import PollSettings from './PollSettings';
import { FaPlay, FaStop } from 'react-icons/fa6';

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
    question: '',
    options: ['', ''],
    isActive: false
  });
  const [results, setResults] = useState<PollResults>({
    votes: {},
    totalVotes: 0,
    participantCount: 0
  });
  const [participantCount, setParticipantCount] = useState(0);
  
  const { showModal, hideModal } = useModal();
  
  const {
    socket,
    roomCode,
    isConnecting,
    connectionError,
    isConnected,
    createRoom
  } = useNetworkedWidget({
    widgetId,
    roomType: 'poll',
    onSocketConnected: (newSocket) => {
      // Set up poll-specific socket listeners
      newSocket.on('participant:count', (data) => {
        setParticipantCount(data.count);
      });

      newSocket.on('results:update', (data) => {
        setResults(data);
      });
    }
  });


  // Toggle poll active state
  const togglePoll = () => {
    const newState = !pollData.isActive;
    const updatedPollData = { ...pollData, isActive: newState };
    setPollData(updatedPollData);
    
    if (roomCode && socket) {
      // First update the poll data
      socket.emit('poll:update', {
        code: roomCode,
        pollData: updatedPollData
      });
      
      // Then toggle the state
      socket.emit('poll:toggle', {
        code: roomCode,
        isActive: newState
      });
    }
  };

  // Open settings modal
  const openSettings = () => {
    showModal({
      title: 'Poll Settings',
      content: (
        <PollSettings
          question={pollData.question}
          options={pollData.options}
          onSave={(question, options) => {
            setPollData({ ...pollData, question, options });
            // Update poll on server
            if (roomCode && socket) {
              socket.emit('poll:update', {
                code: roomCode,
                pollData: { ...pollData, question, options }
              });
            }
            hideModal();
          }}
        />
      ),
      className: 'bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-2xl'
    });
  };

  const getVotePercentage = (index: number) => {
    const votes = results.votes[index] || 0;
    const total = results.totalVotes || 1;
    return Math.round((votes / total) * 100);
  };

  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4">
      {!roomCode ? (
        <NetworkedWidgetEmpty
          title="Poll"
          description="Create real-time polls for your students"
          icon="📊"
          connectionError={connectionError}
          isConnecting={isConnecting}
          onCreateRoom={createRoom}
          createButtonText="Create Poll Room"
        />
      ) : (
        <>
          <NetworkedWidgetHeader roomCode={roomCode}>
            <div className="flex items-center gap-2">
                <button
                  onClick={(_e) => {
                    togglePoll();
                  }}
                  className={`px-3 py-1.5 text-white text-sm rounded transition-colors duration-200 flex items-center gap-1.5 ${
                    pollData.isActive
                      ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600'
                      : 'bg-sage-500 hover:bg-sage-600'
                  }`}
                  disabled={!pollData.question || pollData.options.some(o => !o)}
                  title={pollData.isActive ? 'Stop Poll' : 'Start Poll'}
                >
                  {pollData.isActive ? (
                    <>
                      <FaStop className="text-xs" />
                      Stop
                    </>
                  ) : (
                    <>
                      <FaPlay className="text-xs" />
                      Start
                    </>
                  )}
                </button>
                <button
                  onClick={(_e) => {
                    openSettings();
                  }}
                  className="px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white text-sm rounded transition-colors duration-200"
                >
                  Settings
                </button>
            </div>
          </NetworkedWidgetHeader>
          
          {/* Content Section */}
          <div className={`flex-1 overflow-y-auto ${!pollData.isActive ? 'opacity-50' : ''}`}>
            {pollData.question ? (
              <>
                <h3 className={`text-lg font-semibold mb-4 ${
                  pollData.isActive 
                    ? 'text-warm-gray-800 dark:text-warm-gray-200' 
                    : 'text-warm-gray-500 dark:text-warm-gray-500'
                }`}>
                  {pollData.question}
                </h3>
                <div className="space-y-3">
                  {pollData.options.map((option, index) => (
                    <div key={index} className="relative">
                      <div className={`relative rounded-lg p-3 overflow-hidden ${
                        pollData.isActive
                          ? 'bg-warm-gray-100 dark:bg-warm-gray-700'
                          : 'bg-warm-gray-50 dark:bg-warm-gray-800'
                      }`}>
                        <div
                          className={`absolute inset-0 transition-all duration-300 ${
                            pollData.isActive
                              ? 'bg-sage-200 dark:bg-sage-600'
                              : 'bg-warm-gray-200 dark:bg-warm-gray-700'
                          }`}
                          style={{ width: `${getVotePercentage(index)}%` }}
                        />
                        <div className="relative flex justify-between items-center">
                          <span className={`${
                            pollData.isActive
                              ? 'text-warm-gray-800 dark:text-warm-gray-200'
                              : 'text-warm-gray-500 dark:text-warm-gray-500'
                          }`}>
                            {option}
                          </span>
                          <span className={`text-sm ${
                            pollData.isActive
                              ? 'text-warm-gray-600 dark:text-warm-gray-400'
                              : 'text-warm-gray-400 dark:text-warm-gray-600'
                          }`}>
                            {results.votes[index] || 0} ({getVotePercentage(index)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-warm-gray-500 dark:text-warm-gray-400">
                Click Settings to create your poll
              </div>
            )}
          </div>
          
          {/* Footer Section */}
          <div className="mt-4 pt-3 border-t border-warm-gray-200 dark:border-warm-gray-700 flex justify-between items-center text-xs text-warm-gray-500 dark:text-warm-gray-400">
            <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
            <span>{pollData.isActive ? 'Poll Active' : 'Poll Inactive'}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default Poll;