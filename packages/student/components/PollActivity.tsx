import React from 'react';
import { Socket } from 'socket.io-client';
import { usePollSocket, type PollData } from '../hooks/usePollSocket';
import { getStudentPollColor } from '@shared/constants/studentPollColors';

interface PollActivityProps {
  socket: Socket;
  roomCode: string;
  initialPollData?: PollData;
  initialIsActive?: boolean;
  widgetId?: string;
}

const PollActivity: React.FC<PollActivityProps> = ({ socket, roomCode, initialPollData, initialIsActive, widgetId }) => {

  // Use our custom hook for all socket logic
  const { pollData, isActive, submission, isConnected, results, handleVote } = usePollSocket({
    socket,
    roomCode,
    widgetId,
    initialPollData,
    initialIsActive
  });
  const hasVoted = submission.status === 'acknowledged';
  const selectedOption = submission.optionIndex;

  const renderContent = () => {
    
    if (!pollData.question || pollData.options.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-warm-gray-600 dark:text-warm-gray-400 mb-2">
              Poll Paused
            </h2>
            <p className="text-warm-gray-500 text-sm">
              Waiting for teacher to start the poll...
            </p>
          </div>
        </div>
      );
    }

    // Poll is not active and student hasn't voted
    if (!isActive && selectedOption === null) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-warm-gray-600 dark:text-warm-gray-400 mb-2">
              Poll Paused
            </h2>
            <p className="text-warm-gray-500 text-sm">
              Waiting for teacher to start the poll...
            </p>
          </div>
        </div>
      );
    }

    // Show results if available
    if (hasVoted && results) {
      return renderResults();
    }

    // If student has voted (but no results yet) or has selected an option, show grayed out poll
    if (hasVoted || selectedOption !== null) {
      return (
        <>
          <div className="text-xl font-semibold text-warm-gray-400 mb-3 text-center">{pollData.question}</div>
          <div className="flex flex-col gap-2">
            {pollData.options.map((option, index) => {
              const color = getStudentPollColor(index);
              return (
              <div
                key={index}
                className={`p-3 border-2 rounded-lg cursor-not-allowed transition-all duration-200 relative overflow-hidden ${
                  selectedOption === index 
                    ? color.selected 
                    : 'opacity-50 border-warm-gray-300 dark:border-warm-gray-600 bg-warm-gray-50 dark:bg-warm-gray-800'
                }`}
              >
                <div className="relative z-[1] text-warm-gray-800 dark:text-warm-gray-200">{option}</div>
              </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-sm text-warm-gray-500 dark:text-warm-gray-400" role="status">
            {hasVoted ? 'Vote received. Waiting for results…'
              : submission.status === 'uncertain'
                ? 'We couldn’t confirm your vote. It may have been counted. Please wait or ask your teacher to reset the poll before voting again.'
                : 'Sending your vote…'}
          </p>
        </>
      );
    }

    // Poll is active and student hasn't voted yet
    return (
      <>
        <div className="text-xl font-semibold text-warm-gray-800 dark:text-warm-gray-200 mb-3 text-center">{pollData.question}</div>
        <div className="flex flex-col gap-2">
          {pollData.options.map((option, index) => {
            const color = getStudentPollColor(index);
            return (
            <button
              key={index}
              type="button"
              disabled={!isConnected}
              className={`w-full text-left p-3 border-2 rounded-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 relative overflow-hidden ${
                selectedOption === index 
                  ? color.selected 
                  : 'border-warm-gray-300 dark:border-warm-gray-600 bg-white dark:bg-warm-gray-800 hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700'
              }`}
              onClick={() => handleVote(index)}
            >
              <div className="relative z-[1] text-warm-gray-800 dark:text-warm-gray-200">{option}</div>
            </button>
            );
          })}
        </div>
      </>
    );
  };

  const renderResults = () => {
    if (!results) return null;
    const totalVotes = results.totalVotes || 1;
    // Use results.options if available, otherwise fall back to pollData.options
    const options = results.options || pollData.options || [];

    return (
      <>
        <div className="text-xl font-semibold text-warm-gray-800 dark:text-warm-gray-200 mb-3 text-center">{results.question || pollData.question}</div>
        <div className="flex flex-col gap-2">
          {options.map((option, index) => {
            const color = getStudentPollColor(index);
            const votes = results.votes[index] || 0;
            const percentage = Math.round((votes / totalVotes) * 100);
            
            const isMyChoice = selectedOption === index;
            return (
              <div key={index} className={`p-3 border-2 ${isMyChoice ? 'border-sage-500 dark:border-sage-400 bg-sage-50 dark:bg-sage-900/20' : 'border-warm-gray-200 dark:border-warm-gray-600 bg-white dark:bg-warm-gray-800'} rounded-lg cursor-default relative overflow-hidden transition-all duration-200`}>
                <div className={`absolute top-0 left-0 h-full ${color.resultsBar} transition-[width] duration-300`} style={{ width: `${percentage}%` }}></div>
                <div className="relative z-[1] flex justify-between items-center text-warm-gray-800 dark:text-warm-gray-200">
                  <div className="flex items-center gap-2">
                    <span className={isMyChoice ? 'font-semibold' : ''}>{option}</span>
                    {isMyChoice && (
                      <span className="text-xs bg-sage-500 text-white px-2 py-0.5 rounded-full">Your choice</span>
                    )}
                  </div>
                  <span className={isMyChoice ? 'font-semibold' : ''}>{percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col">
      {renderContent()}
      {submission.status === 'rejected' && (
        <p className="mt-3 text-center text-sm text-dusty-rose-600 dark:text-dusty-rose-400" role="alert">
          Your vote didn't go through. Please try again when the poll is active and connected.
        </p>
      )}
      {!isConnected && (
        <p className="mt-3 text-center text-sm text-warm-gray-500 dark:text-warm-gray-400" role="status">
          Connection lost. Waiting to reconnect…
        </p>
      )}
    </div>
  );
};

export default PollActivity;
