import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface PollActivityProps {
  socket: Socket;
  roomCode: string;
  initialPollData?: PollData;
  studentName?: string;
  isSession?: boolean;
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

const PollActivity: React.FC<PollActivityProps> = ({ socket, roomCode, initialPollData, studentName, isSession = false }) => {
  const [pollData, setPollData] = useState<PollData>(initialPollData || {
    question: '',
    options: [],
    isActive: false
  });
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    // Listen for poll state changes (harmonized)
    socket.on('poll:stateChanged', (data: { isActive: boolean }) => {
      
      // If poll is restarted (was inactive, now active), reset vote state
      if (!pollData.isActive && data.isActive) {
        setHasVoted(false);
        setSelectedOption(null);
        setResults(null);
      }
      
      setPollData(prev => ({ ...prev, isActive: data.isActive }));
    });
    
    // Listen for poll data updates (harmonized)
    socket.on('poll:dataUpdate', (data: { pollData: PollData; results?: Results }) => {
      
      if (data.pollData) {
        setPollData(data.pollData);
      }
      if (data.results) {
        setResults(data.results);
      }
    });

    // Listen for results updates (harmonized)
    socket.on('poll:resultsUpdate', (data: Results) => {
      setResults(data);
    });

    // Listen for vote confirmation
    socket.on('vote:confirmed', (data: { success: boolean }) => {
      if (data.success) {
        setHasVoted(true);
      }
    });

    // Request current poll state if we don't have initial data or it's empty
    let timer: NodeJS.Timeout | undefined;
    const hasInitialData = initialPollData && initialPollData.question && initialPollData.options;
    if (!hasInitialData) {
      // Small delay to ensure component is fully mounted and server has processed join
      timer = setTimeout(() => {
        socket.emit('poll:requestState', { code: roomCode });
      }, 100);
    }

    return () => {
      if (timer) clearTimeout(timer);
      socket.off('poll:stateChanged');
      socket.off('poll:dataUpdate');
      socket.off('poll:resultsUpdate');
      socket.off('vote:confirmed');
    };
  }, [socket, roomCode]);

  const handleVote = (optionIndex: number) => {
    if (hasVoted || !pollData.isActive) return;
    
    setSelectedOption(optionIndex);
    
    if (isSession) {
      socket.emit('session:poll:vote', { 
        sessionCode: roomCode, 
        option: optionIndex 
      });
    } else {
      socket.emit('vote:submit', { code: roomCode, optionIndex });
    }
  };

  const renderContent = () => {
    if (!pollData.question || pollData.options.length === 0) {
      return <div className="text-center text-warm-gray-600 text-base py-10 px-5">Waiting for poll to start...</div>;
    }

    // Poll is not active and student hasn't voted
    if (!pollData.isActive && !hasVoted) {
      return <div className="text-center text-warm-gray-600 text-base py-10 px-5">Waiting for poll to start...</div>;
    }

    // Show results if available
    if (hasVoted && results) {
      return renderResults();
    }

    // If student has voted (but no results yet) or has selected an option, show grayed out poll
    if (hasVoted || selectedOption !== null) {
      return (
        <>
          <div className="text-2xl font-semibold text-warm-gray-400 mb-6 text-center">{pollData.question}</div>
          <div className="flex flex-col gap-3 opacity-50">
            {pollData.options.map((option, index) => (
              <div
                key={index}
                className={`p-4 border-2 rounded-lg cursor-not-allowed transition-all duration-200 relative overflow-hidden ${
                  selectedOption === index 
                    ? 'border-warm-gray-400 bg-warm-gray-400 text-white' 
                    : 'border-warm-gray-300 bg-warm-gray-50'
                }`}
              >
                <div className="relative z-[1]">{option}</div>
              </div>
            ))}
          </div>
        </>
      );
    }

    // Poll is active and student hasn't voted yet
    return (
      <>
        <div className="text-2xl font-semibold text-warm-gray-800 mb-6 text-center">{pollData.question}</div>
        <div className="flex flex-col gap-3">
          {pollData.options.map((option, index) => (
            <div
              key={index}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 relative overflow-hidden ${selectedOption === index ? 'border-sage-500 bg-sage-500 text-white' : 'border-warm-gray-300 hover:border-sage-500 hover:bg-sage-50'}`}
              onClick={() => handleVote(index)}
            >
              <div className="relative z-[1]">{option}</div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderResults = () => {
    if (!results) return null;
    const totalVotes = results.totalVotes || 1;

    return (
      <>
        <div className="text-2xl font-semibold text-warm-gray-800 mb-6 text-center">{results.question}</div>
        <div className="flex flex-col gap-3">
          {results.options.map((option, index) => {
            const votes = results.votes[index] || 0;
            const percentage = Math.round((votes / totalVotes) * 100);
            
            return (
              <div key={index} className="p-4 border-2 border-warm-gray-300 rounded-lg cursor-default relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-sage-500/20 transition-[width] duration-300" style={{ width: `${percentage}%` }}></div>
                <div className="relative z-[1] flex justify-between items-center">
                  <span>{option}</span>
                  <span>{votes} ({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-[200px] flex flex-col justify-center">
      {renderContent()}
    </div>
  );
};

export default PollActivity;