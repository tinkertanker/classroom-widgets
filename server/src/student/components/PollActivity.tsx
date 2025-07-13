import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface PollActivityProps {
  socket: Socket;
  roomCode: string;
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

const PollActivity: React.FC<PollActivityProps> = ({ socket, roomCode }) => {
  const [pollData, setPollData] = useState<PollData>({
    question: '',
    options: [],
    isActive: false
  });
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    // Listen for poll updates
    socket.on('poll:updated', (data: PollData) => {
      // DEBUG: Log poll update
      console.log('Poll updated:', data);
      setPollData(data);
    });

    // Listen for results
    socket.on('results:update', (data: Results) => {
      // DEBUG: Log results update
      console.log('Results update:', data);
      setResults(data);
    });

    // Listen for vote confirmation
    socket.on('vote:confirmed', (data: { success: boolean }) => {
      if (data.success) {
        setHasVoted(true);
      }
    });

    // Handle initial join data
    socket.on('room:joined', (data: any) => {
      if (data.success && data.type === 'poll' && data.pollData) {
        setPollData(data.pollData);
      }
    });

    return () => {
      socket.off('poll:updated');
      socket.off('results:update');
      socket.off('vote:confirmed');
    };
  }, [socket]);

  const handleVote = (optionIndex: number) => {
    if (hasVoted || !pollData.isActive) return;
    
    setSelectedOption(optionIndex);
    socket.emit('vote:submit', { code: roomCode, optionIndex });
  };

  const renderContent = () => {
    if (!pollData.question || pollData.options.length === 0) {
      return <div className="text-center text-warm-gray-600 text-base py-10 px-5">Waiting for poll to start...</div>;
    }

    if (hasVoted) {
      if (results) {
        return renderResults();
      }
      return <div className="text-center text-sage-600 text-lg font-semibold py-10 px-5">Thank you for voting!</div>;
    }

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
    <div>
      <div className={`text-center py-2 px-4 rounded-lg text-sm mb-4 ${pollData.isActive ? 'bg-sage-100 text-sage-700' : 'bg-warm-gray-200 text-warm-gray-700'}`}>
        {pollData.isActive ? 'Poll Active' : 'Poll Closed'}
      </div>
      
      <div className="min-h-[200px] flex flex-col justify-center">
        {renderContent()}
      </div>
      
    </div>
  );
};

export default PollActivity;