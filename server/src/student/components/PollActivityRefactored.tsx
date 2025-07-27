import React, { useState, useEffect } from 'react';
import { PollActivityProps } from '../types/activity.types';
import { useActivitySocket } from '../hooks/useActivitySocket';
import { ActivityBase } from './ActivityBase';

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

const PollActivityRefactored: React.FC<PollActivityProps> = ({ 
  socket, 
  sessionCode, 
  initialPollData, 
  widgetId 
}) => {
  const [pollData, setPollData] = useState<PollData>(initialPollData || {
    question: '',
    options: [],
    isActive: false
  });
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use common socket hook
  const { emit, on, off, isConnected } = useActivitySocket({
    socket,
    sessionCode,
    roomType: 'poll',
    widgetId,
    onRequestState: () => {
      emit('poll:requestState', { code: sessionCode, widgetId });
    }
  });

  // Setup event listeners
  useEffect(() => {
    // State change handler
    const handleStateChanged = (data: { isActive: boolean }) => {
      // Reset vote state when poll restarts
      if (!pollData.isActive && data.isActive) {
        setHasVoted(false);
        setSelectedOption(null);
        setResults(null);
      }
      setPollData(prev => ({ ...prev, isActive: data.isActive }));
    };

    // Data update handler
    const handleDataUpdate = (data: { pollData: PollData; results?: Results }) => {
      if (data.pollData) {
        setPollData(data.pollData);
      }
      if (data.results) {
        setResults(data.results);
      }
    };

    // Results update handler
    const handleResultsUpdate = (data: Results) => {
      setResults(data);
    };

    // Vote confirmation handler
    const handleVoteConfirmed = (data: { success: boolean; error?: string }) => {
      if (data.success) {
        setHasVoted(true);
      } else {
        setError(data.error || 'Vote failed');
        setSelectedOption(null);
      }
    };

    // Register event listeners
    on('poll:stateChanged', handleStateChanged);
    on('poll:dataUpdate', handleDataUpdate);
    on('poll:voteUpdate', handleResultsUpdate);
    on('vote:confirmed', handleVoteConfirmed);

    // Cleanup
    return () => {
      off('poll:stateChanged', handleStateChanged);
      off('poll:dataUpdate', handleDataUpdate);
      off('poll:voteUpdate', handleResultsUpdate);
      off('vote:confirmed', handleVoteConfirmed);
    };
  }, [on, off, pollData.isActive]);

  // Handle vote submission
  const handleVote = (optionIndex: number) => {
    if (hasVoted || !pollData.isActive) return;
    
    setSelectedOption(optionIndex);
    setError(null);
    
    emit('session:poll:vote', { 
      sessionCode, 
      option: optionIndex,
      widgetId
    });
  };

  // Render poll content
  const renderPollContent = () => {
    // No poll data yet
    if (!pollData.question || pollData.options.length === 0) {
      return (
        <div className="text-center text-warm-gray-600 dark:text-warm-gray-400 text-base py-10 px-5">
          Waiting for poll to start...
        </div>
      );
    }

    // Show results if available and voted
    if (hasVoted && results) {
      return <PollResults results={results} />;
    }

    // Show options for voting
    if (pollData.isActive && !hasVoted) {
      return (
        <PollOptions 
          options={pollData.options}
          selectedOption={selectedOption}
          onVote={handleVote}
        />
      );
    }

    // Show grayed out options after voting
    if (hasVoted || selectedOption !== null) {
      return (
        <PollOptions 
          options={pollData.options}
          selectedOption={selectedOption}
          onVote={() => {}}
          disabled={true}
        />
      );
    }

    return null;
  };

  return (
    <ActivityBase
      title={pollData.question}
      isActive={pollData.isActive || hasVoted}
      isConnected={isConnected}
      error={error}
      pausedMessage="Waiting for poll to start..."
      roomCode={sessionCode}
    >
      <div className="min-h-[200px] flex flex-col justify-center">
        {renderPollContent()}
      </div>
    </ActivityBase>
  );
};

// Poll options component
const PollOptions: React.FC<{
  options: string[];
  selectedOption: number | null;
  onVote: (index: number) => void;
  disabled?: boolean;
}> = ({ options, selectedOption, onVote, disabled }) => {
  return (
    <div className="flex flex-col gap-3">
      {options.map((option, index) => (
        <button
          key={index}
          className={`p-4 border-2 rounded-lg transition-all duration-200 relative overflow-hidden ${
            disabled 
              ? 'cursor-not-allowed opacity-50' 
              : 'cursor-pointer hover:border-sage-500 hover:bg-sage-50 dark:hover:bg-sage-900/20'
          } ${
            selectedOption === index 
              ? disabled
                ? 'border-warm-gray-400 bg-warm-gray-400 text-white dark:bg-warm-gray-600' 
                : 'border-sage-500 bg-sage-500 text-white'
              : 'border-warm-gray-300 dark:border-warm-gray-600'
          }`}
          onClick={() => !disabled && onVote(index)}
          disabled={disabled}
        >
          <div className="relative z-[1]">{option}</div>
        </button>
      ))}
    </div>
  );
};

// Poll results component
const PollResults: React.FC<{ results: Results }> = ({ results }) => {
  const totalVotes = results.totalVotes || 1;

  return (
    <div className="flex flex-col gap-3">
      {results.options.map((option, index) => {
        const votes = results.votes[index] || 0;
        const percentage = Math.round((votes / totalVotes) * 100);
        
        return (
          <div 
            key={index} 
            className="p-4 border-2 border-warm-gray-300 dark:border-warm-gray-600 rounded-lg relative overflow-hidden"
          >
            <div 
              className="absolute top-0 left-0 h-full bg-sage-500/20 transition-[width] duration-300" 
              style={{ width: `${percentage}%` }}
            />
            <div className="relative z-[1] flex justify-between items-center">
              <span>{option}</span>
              <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                {votes} ({percentage}%)
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PollActivityRefactored;