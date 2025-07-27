import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

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

interface UsePollSocketProps {
  socket: Socket;
  roomCode: string;
  widgetId?: string;
  isSession?: boolean;
  initialPollData?: PollData;
}

interface UsePollSocketReturn {
  pollData: PollData;
  hasVoted: boolean;
  selectedOption: number | null;
  results: Results | null;
  handleVote: (optionIndex: number) => void;
}

/**
 * Custom hook to manage poll socket events and state
 * Extracts all socket logic from PollActivity component
 */
export const usePollSocket = ({
  socket,
  roomCode,
  widgetId,
  isSession = false,
  initialPollData
}: UsePollSocketProps): UsePollSocketReturn => {
  const [pollData, setPollData] = useState<PollData>(initialPollData || {
    question: '',
    options: [],
    isActive: false
  });
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  // Socket event listeners
  useEffect(() => {
    // Poll state changes
    const handleStateChanged = (data: { isActive: boolean }) => {
      // Reset vote state when poll restarts
      if (!pollData.isActive && data.isActive) {
        setHasVoted(false);
        setSelectedOption(null);
        setResults(null);
      }
      setPollData(prev => ({ ...prev, isActive: data.isActive }));
    };

    // Poll data updates
    const handleDataUpdate = (data: { pollData: PollData; results?: Results }) => {
      if (data.pollData) {
        setPollData(data.pollData);
      }
      if (data.results) {
        setResults(data.results);
      }
    };

    // Vote updates
    const handleVoteUpdate = (data: Results) => {
      setResults(data);
    };

    // Vote confirmation
    const handleVoteConfirmed = (data: { success: boolean }) => {
      if (data.success) {
        setHasVoted(true);
      }
    };

    // Register listeners
    socket.on('poll:stateChanged', handleStateChanged);
    socket.on('poll:dataUpdate', handleDataUpdate);
    socket.on('poll:voteUpdate', handleVoteUpdate);
    socket.on('vote:confirmed', handleVoteConfirmed);

    // Request initial state if needed
    let timer: NodeJS.Timeout | undefined;
    const hasInitialData = initialPollData && initialPollData.question && initialPollData.options;
    if (!hasInitialData) {
      timer = setTimeout(() => {
        socket.emit('poll:requestState', { code: roomCode, widgetId });
      }, 100);
    }

    // Cleanup
    return () => {
      if (timer) clearTimeout(timer);
      socket.off('poll:stateChanged', handleStateChanged);
      socket.off('poll:dataUpdate', handleDataUpdate);
      socket.off('poll:voteUpdate', handleVoteUpdate);
      socket.off('vote:confirmed', handleVoteConfirmed);
    };
  }, [socket, roomCode, widgetId, initialPollData, pollData.isActive]);

  const handleVote = (optionIndex: number) => {
    if (hasVoted || !pollData.isActive) return;
    
    setSelectedOption(optionIndex);
    
    socket.emit('session:poll:vote', { 
      sessionCode: roomCode, 
      option: optionIndex,
      widgetId
    });
  };

  return {
    pollData,
    hasVoted,
    selectedOption,
    results,
    handleVote
  };
};