import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import './PollActivity.css';

interface PollActivityProps {
  socket: Socket;
  roomCode: string;
  onChangeRoom: () => void;
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

const PollActivity: React.FC<PollActivityProps> = ({ socket, roomCode, onChangeRoom }) => {
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
      return <div className="waiting">Waiting for poll to start...</div>;
    }

    if (hasVoted) {
      if (results) {
        return renderResults();
      }
      return <div className="thank-you">Thank you for voting!</div>;
    }

    return (
      <>
        <div className="poll-question">{pollData.question}</div>
        <div className="poll-options">
          {pollData.options.map((option, index) => (
            <div
              key={index}
              className={`poll-option ${selectedOption === index ? 'selected' : ''}`}
              onClick={() => handleVote(index)}
            >
              <div className="vote-content">{option}</div>
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
        <div className="poll-question">{results.question}</div>
        <div className="poll-options">
          {results.options.map((option, index) => {
            const votes = results.votes[index] || 0;
            const percentage = Math.round((votes / totalVotes) * 100);
            
            return (
              <div key={index} className="poll-option voted">
                <div className="vote-bar" style={{ width: `${percentage}%` }}></div>
                <div className="vote-content">
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
    <div className="activity-container">
      <div className="activity-header">
        <div className="room-code">Room: <span>{roomCode}</span></div>
        <div className="activity-type poll">Poll</div>
      </div>
      
      <div className={`status ${pollData.isActive ? 'active' : 'inactive'}`}>
        {pollData.isActive ? 'Poll Active' : 'Poll Closed'}
      </div>
      
      <div className="poll-body">
        {renderContent()}
      </div>
      
      <button className="change-room" onClick={onChangeRoom}>
        Change Room
      </button>
    </div>
  );
};

export default PollActivity;