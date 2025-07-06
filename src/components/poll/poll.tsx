import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

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
  const [showSettings, setShowSettings] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io('http://localhost:3001');
    
    socketRef.current.on('connect', () => {
      console.log('Connected to server');
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
    try {
      const response = await fetch('http://localhost:3001/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        setRoomCode(data.code);
        // Join room as host
        socketRef.current?.emit('host:join', data.code);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  // Update poll data on server
  const updatePoll = () => {
    if (roomCode && socketRef.current) {
      socketRef.current.emit('poll:update', {
        code: roomCode,
        pollData: pollData
      });
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

  // Add option
  const addOption = () => {
    setPollData({
      ...pollData,
      options: [...pollData.options, '']
    });
  };

  // Remove option
  const removeOption = (index: number) => {
    if (pollData.options.length > 2) {
      setPollData({
        ...pollData,
        options: pollData.options.filter((_, i) => i !== index)
      });
    }
  };

  // Update option text
  const updateOption = (index: number, value: string) => {
    const newOptions = [...pollData.options];
    newOptions[index] = value;
    setPollData({
      ...pollData,
      options: newOptions
    });
  };

  // Settings modal content
  const renderSettings = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-warm-gray-800 dark:text-warm-gray-200 mb-4">
          Poll Settings
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
              Question
            </label>
            <input
              type="text"
              value={pollData.question}
              onChange={(e) => setPollData({ ...pollData, question: e.target.value })}
              className="w-full px-3 py-2 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What's your poll question?"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
              Options
            </label>
            {pollData.options.map((option, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Option ${index + 1}`}
                />
                {pollData.options.length > 2 && (
                  <button
                    onClick={() => removeOption(index)}
                    className="px-3 py-2 bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white rounded-md text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addOption}
              className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200"
            >
              Add Option
            </button>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setShowSettings(false)}
            className="px-3 py-1.5 bg-warm-gray-300 hover:bg-warm-gray-400 text-warm-gray-700 text-sm rounded transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              updatePoll();
              setShowSettings(false);
            }}
            className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

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
            className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded transition-colors duration-200"
          >
            Create Poll Room
          </button>
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
              onClick={() => setShowSettings(true)}
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
      
      {showSettings && renderSettings()}
    </div>
  );
}

export default Poll;