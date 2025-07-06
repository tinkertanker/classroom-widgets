import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { useModal } from '../../contexts/ModalContext';
import PollSettings from './PollSettings';

interface PollProps {
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

function Poll({ savedState, onStateChange }: PollProps) {
  const [roomCode, setRoomCode] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
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
  const [connectionError, setConnectionError] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const { showModal, hideModal } = useModal();

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io('http://localhost:3001', {
      autoConnect: false // Don't connect until user creates a room
    });
    
    socketRef.current.on('connect', () => {
      console.log('Connected to server');
      setConnectionError('');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError('Unable to connect to server. Make sure the server is running on port 3001.');
      setIsConnecting(false);
    });

    socketRef.current.on('host:joined', (data) => {
      if (data.success) {
        setIsConnected(true);
        console.log('Joined room:', data.code);
      }
    });

    socketRef.current.on('participant:count', (data) => {
      setParticipantCount(data.count);
    });

    socketRef.current.on('results:update', (data) => {
      setResults(data);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Create room and get code
  const createRoom = async () => {
    setIsConnecting(true);
    setConnectionError('');
    
    try {
      // First connect the socket
      socketRef.current?.connect();
      
      // Wait a bit for connection
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await fetch('http://localhost:3001/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Server request failed');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setRoomCode(data.code);
        // Join room as host
        socketRef.current?.emit('host:join', data.code);
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
      setConnectionError('Cannot connect to server. Please ensure the server is running (cd server && npm start).');
      setIsConnecting(false);
      socketRef.current?.disconnect();
    }
  };

  // Toggle poll active state
  const togglePoll = () => {
    const newState = !pollData.isActive;
    const updatedPollData = { ...pollData, isActive: newState };
    setPollData(updatedPollData);
    
    if (roomCode && socketRef.current) {
      // First update the poll data
      socketRef.current.emit('poll:update', {
        code: roomCode,
        pollData: updatedPollData
      });
      
      // Then toggle the state
      socketRef.current.emit('poll:toggle', {
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
            if (roomCode && socketRef.current) {
              socketRef.current.emit('poll:update', {
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
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-warm-gray-600 dark:text-warm-gray-400 mb-4">
            Create a room to start a poll
          </p>
          <button
            onClick={createRoom}
            disabled={isConnecting}
            className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : 'Create Poll Room'}
          </button>
          {connectionError && (
            <div className="mt-4 p-3 bg-dusty-rose-100 dark:bg-dusty-rose-900 border border-dusty-rose-300 dark:border-dusty-rose-700 rounded-md max-w-sm">
              <p className="text-sm text-dusty-rose-700 dark:text-dusty-rose-300">
                {connectionError}
              </p>
              <p className="text-xs text-dusty-rose-600 dark:text-dusty-rose-400 mt-2">
                Start the server with: <code className="bg-dusty-rose-200 dark:bg-dusty-rose-800 px-1 rounded">cd server && npm start</code>
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400">Room Code</p>
                <p className="text-2xl font-bold text-warm-gray-800 dark:text-warm-gray-200">
                  {roomCode}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400">Participants</p>
                <p className="text-xl font-semibold text-warm-gray-800 dark:text-warm-gray-200">
                  {participantCount}
                </p>
              </div>
            </div>
            <button
              onClick={openSettings}
              className="px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white text-sm rounded transition-colors duration-200"
            >
              Settings
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {pollData.question ? (
              <>
                <h3 className="text-lg font-semibold text-warm-gray-800 dark:text-warm-gray-200 mb-4">
                  {pollData.question}
                </h3>
                <div className="space-y-3">
                  {pollData.options.map((option, index) => (
                    <div key={index} className="relative">
                      <div className="relative bg-warm-gray-100 dark:bg-warm-gray-700 rounded-lg p-3 overflow-hidden">
                        <div
                          className="absolute inset-0 bg-sage-200 dark:bg-sage-600 transition-all duration-300"
                          style={{ width: `${getVotePercentage(index)}%` }}
                        />
                        <div className="relative flex justify-between items-center">
                          <span className="text-warm-gray-800 dark:text-warm-gray-200">
                            {option}
                          </span>
                          <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
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
          
          <div className="mt-4 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
            <button
              onClick={togglePoll}
              className={`w-full px-4 py-2 text-white rounded transition-colors duration-200 ${
                pollData.isActive
                  ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600'
                  : 'bg-sage-500 hover:bg-sage-600'
              }`}
              disabled={!pollData.question || pollData.options.some(o => !o)}
            >
              {pollData.isActive ? 'Stop Poll' : 'Start Poll'}
            </button>
          </div>
          
          <div className="mt-2 text-center text-sm text-warm-gray-500 dark:text-warm-gray-400">
            Students visit: http://localhost:3001
          </div>
        </>
      )}
    </div>
  );
}

export default Poll;