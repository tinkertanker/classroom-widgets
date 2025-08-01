import React from 'react';
import { Socket } from 'socket.io-client';
import { usePollSocket } from '../hooks/usePollSocket';
import { getStudentPollColor } from '../../../../src/shared/constants/studentPollColors';

interface PollActivityProps {
  socket: Socket;
  roomCode: string;
  initialPollData?: PollData;
  studentName?: string;
  isSession?: boolean;
  widgetId?: string;
}

interface PollData {
  question: string;
  options: string[];
  isActive: boolean;
  votes?: Record<number, number>;
}

interface Results {
  question: string;
  options: string[];
  votes: Record<number, number>;
  totalVotes: number;
}

const PollActivity: React.FC<PollActivityProps> = ({ socket, roomCode, initialPollData, studentName, isSession = false, widgetId }) => {

  // Use our custom hook for all socket logic
  const { pollData, hasVoted, selectedOption, results, handleVote } = usePollSocket({
    socket,
    roomCode,
    widgetId,
    isSession,
    initialPollData
  });

  const renderContent = () => {
    if (!pollData.question || pollData.options.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-warm-gray-600 mb-2">
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
    if (!pollData.isActive && !hasVoted) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-warm-gray-600 mb-2">
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
          <div className="flex flex-col gap-2 opacity-50">
            {pollData.options.map((option, index) => {
              const color = getStudentPollColor(index);
              return (
              <div
                key={index}
                className={`p-3 border-2 rounded-lg cursor-not-allowed transition-all duration-200 relative overflow-hidden ${
                  selectedOption === index 
                    ? color.disabled 
                    : 'border-warm-gray-300 bg-warm-gray-50'
                }`}
              >
                <div className="relative z-[1]">{option}</div>
              </div>
              );
            })}
          </div>
        </>
      );
    }

    // Poll is active and student hasn't voted yet
    return (
      <>
        <div className="text-xl font-semibold text-warm-gray-800 mb-3 text-center">{pollData.question}</div>
        <div className="flex flex-col gap-2">
          {pollData.options.map((option, index) => {
            const color = getPollColor(index);
            return (
            <div
              key={index}
              className={`p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 relative overflow-hidden ${
                selectedOption === index 
                  ? color.selected 
                  : 'border-warm-gray-300 bg-white hover:bg-warm-gray-50'
              }`}
              onClick={() => handleVote(index)}
            >
              <div className="relative z-[1]">{option}</div>
            </div>
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
        <div className="text-xl font-semibold text-warm-gray-800 mb-3 text-center">{results.question || pollData.question}</div>
        <div className="flex flex-col gap-2">
          {options.map((option, index) => {
            const color = getPollColor(index);
            const votes = results.votes[index] || 0;
            const percentage = Math.round((votes / totalVotes) * 100);
            
            return (
              <div key={index} className={`p-3 border-2 ${color.borderLight} ${selectedOption === index ? color.results : 'bg-warm-gray-50'} rounded-lg cursor-default relative overflow-hidden`}>
                <div className={`absolute top-0 left-0 h-full ${color.resultsBar} transition-[width] duration-300`} style={{ width: `${percentage}%` }}></div>
                <div className="relative z-[1] flex justify-between items-center">
                  <span>{option}</span>
                  <span>{percentage}%</span>
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
    </div>
  );
};

export default PollActivity;