import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useWidgetStateChange } from './useWidgetStateChange';
import { initialPollSubmission, pollSubmissionReducer, type PollSubmission, type PollSubmissionEvent } from './pollSubmission';

export interface PollData {
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
  initialPollData?: PollData;
  initialIsActive?: boolean;
}

interface UsePollSocketReturn {
  pollData: PollData;
  isActive: boolean;
  submission: PollSubmission;
  isConnected: boolean;
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
  initialPollData,
  initialIsActive = false
}: UsePollSocketProps): UsePollSocketReturn => {
  const [pollData, setPollData] = useState<PollData>(initialPollData || {
    question: '',
    options: []
  });
  const [isActive, setIsActive] = useState(initialIsActive);
  const [submission, setSubmission] = useState(initialPollSubmission);
  const submissionRef = useRef(submission);
  // Advance synchronously: two actions in the same render must not emit twice.
  const transition = useCallback((event: PollSubmissionEvent) => {
    const next = pollSubmissionReducer(submissionRef.current, event);
    submissionRef.current = next;
    setSubmission(next);
    return next;
  }, []);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [results, setResults] = useState<Results | null>(null);
  const optionsRef = useRef(initialPollData?.options);

  useEffect(() => {
    submissionRef.current = initialPollSubmission;
    setSubmission(initialPollSubmission);
    setResults(null);
    optionsRef.current = initialPollData?.options;
    setPollData(initialPollData || { question: '', options: [] });
    setIsActive(initialIsActive);
    setIsConnected(socket.connected);
    // A different socket/session/widget owns a different submission lifecycle.
  }, [socket, roomCode, widgetId]);

  useEffect(() => {
    if (submission.status !== 'sending') return;
    const timer = setTimeout(() => {
      // A queued timer cannot affect a newer attempt, even after a reset.
      if (submissionRef.current === submission) transition({ type: 'timeout' });
    }, 5000);
    return () => clearTimeout(timer);
  }, [submission, transition]);

  // Use shared hook for widget state changes
  useWidgetStateChange({
    socket,
    roomCode,
    roomType: 'poll',
    widgetId,
    initialIsActive,
    onStateChange: (newIsActive) => {
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
        if (data.pollData) {
          // The zero-vote broadcast may have been missed while disconnected.
          // Changed options still mean a new poll, even if others voted since.
          if (JSON.stringify(optionsRef.current) !== JSON.stringify(data.pollData.options)) {
            transition({ type: 'reset' });
          }
          optionsRef.current = data.pollData.options;
          setPollData(data.pollData);
        }
        if (data.results) {
          setResults(data.results);
          // No votes counted: the teacher changed the options (a new poll) or
          // reset it, so the server lets this student vote again
          if (data.results.totalVotes === 0) {
            transition({ type: 'reset' });
          }
        }
      }
    };

    // Vote updates
    const handleVoteUpdate = (data: Results & { widgetId?: string }) => {
      // Only process if this update is for our widget
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        setResults(data);
        
        // If total votes is 0, this is a reset - clear the student's selection
        if (data.totalVotes === 0) {
          transition({ type: 'reset' });
        }
      }
    };

    // Vote confirmation
    const handleVoteConfirmed = (data: { success: boolean; widgetId?: string }) => {
      // Only process if this confirmation is for our widget
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        transition({ type: 'confirmed', success: data.success });
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      transition({ type: 'disconnected' });
    };
    const handleConnect = () => setIsConnected(true);

    // Register listeners
    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);
    socket.on('poll:stateUpdate', handleDataUpdate);
    socket.on('poll:voteUpdate', handleVoteUpdate);
    socket.on('session:poll:voteConfirmed', handleVoteConfirmed);

    // Request initial state if needed
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
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
      socket.off('poll:stateUpdate', handleDataUpdate);
      socket.off('poll:voteUpdate', handleVoteUpdate);
      socket.off('session:poll:voteConfirmed', handleVoteConfirmed);
    };
  }, [socket, roomCode, widgetId, initialPollData]);

  const handleVote = (optionIndex: number) => {
    if (!socket?.connected || !isActive || !Number.isInteger(optionIndex)
      || optionIndex < 0 || optionIndex >= pollData.options.length) return;
    const previous = submissionRef.current;
    if (transition({ type: 'submit', optionIndex }) === previous) return;

    socket.emit('session:poll:vote', { 
      sessionCode: roomCode, 
      optionIndex: optionIndex,
      widgetId
    });
  };

  return {
    pollData,
    isActive,
    submission,
    isConnected,
    results,
    handleVote
  };
};
