import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useWidgetStateChange } from './useWidgetStateChange';

interface PollData {
  question: string;
  options: string[];
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
  initialIsActive?: boolean;
}

interface UsePollSocketReturn {
  pollData: PollData;
  isActive: boolean;
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
  initialPollData,
  initialIsActive = false
}: UsePollSocketProps): UsePollSocketReturn => {
  const [pollData, setPollData] = useState<PollData>(initialPollData || {
    question: '',
    options: []
  });
  const [isActive, setIsActive] = useState(initialIsActive);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  
  console.log(`[usePollSocket ${widgetId}] Initialized with isActive:`, initialIsActive);

  // Use shared hook for widget state changes
  useWidgetStateChange({
    socket,
    roomCode,
    roomType: 'poll',
    widgetId,
    initialIsActive,
    onStateChange: (newIsActive) => {
      console.log('[Student Poll] Received widget state change:', newIsActive);
      // Don't reset vote state when poll is paused/resumed - preserve voting data
      setIsActive(newIsActive);
    }
  });

  // Socket event listeners for poll-specific events
  useEffect(() => {
    if (!socket) return;

    // Poll data updates
    const handleDataUpdate = (data: { pollData: PollData; results?: Results; widgetId?: string }) => {
      // Only process if this update is for our widget
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        console.log('[Student Poll] Processing dataUpdate for widget:', widgetId);
        if (data.pollData) {
          setPollData(data.pollData);
        }
        if (data.results) {
          setResults(data.results);
        }
      }
    };

    // Vote updates
    const handleVoteUpdate = (data: Results & { widgetId?: string }) => {
      // Only process if this update is for our widget
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        console.log('[Student Poll] Processing voteUpdate for widget:', widgetId);
        setResults(data);
        
        // If total votes is 0, this is a reset - clear the student's selection
        if (data.totalVotes === 0) {
          console.log('[Student Poll] Votes reset, clearing selection');
          setHasVoted(false);
          setSelectedOption(null);
        }
      }
    };

    // Vote confirmation
    const handleVoteConfirmed = (data: { success: boolean; error?: string; widgetId?: string }) => {
      // Only process if this confirmation is for our widget
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        console.log('[Student Poll] Processing vote confirmation for widget:', widgetId);
        if (data.success) {
          setHasVoted(true);
        }
      }
    };

    // Register listeners - listen to both new and legacy event names for backwards compatibility
    socket.on('poll:stateUpdate', handleDataUpdate);   // New event name
    socket.on('poll:dataUpdate', handleDataUpdate);    // Legacy event name
    socket.on('poll:voteUpdate', handleVoteUpdate);
    socket.on('session:poll:voteConfirmed', handleVoteConfirmed);

    // Request initial state if needed - use sessionCode (new) format
    let timer: NodeJS.Timeout | undefined;
    const hasInitialData = initialPollData && initialPollData.question && initialPollData.options;
    if (!hasInitialData) {
      timer = setTimeout(() => {
        if (socket) {
          socket.emit('poll:requestState', { sessionCode: roomCode, widgetId });
        }
      }, 100);
    }

    // Cleanup
    return () => {
      if (timer) clearTimeout(timer);
      socket.off('poll:stateUpdate', handleDataUpdate);
      socket.off('poll:dataUpdate', handleDataUpdate);
      socket.off('poll:voteUpdate', handleVoteUpdate);
      socket.off('session:poll:voteConfirmed', handleVoteConfirmed);
    };
  }, [socket, roomCode, widgetId, initialPollData]);

  const handleVote = (optionIndex: number) => {
    console.log(`[usePollSocket ${widgetId}] handleVote called - hasVoted: ${hasVoted}, isActive: ${isActive}`);
    if (!socket || hasVoted || !isActive) return;
    
    console.log(`[usePollSocket ${widgetId}] Sending vote for option ${optionIndex}`);
    setSelectedOption(optionIndex);
    
    socket.emit('session:poll:vote', { 
      sessionCode: roomCode, 
      optionIndex: optionIndex,
      widgetId
    });
  };

  return {
    pollData,
    isActive,
    hasVoted,
    selectedOption,
    results,
    handleVote
  };
};