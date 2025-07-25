import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { FaSun, FaMoon } from 'react-icons/fa6';
import JoinForm from './components/JoinForm';
import SessionDashboard from './components/SessionDashboard';

export type RoomType = 'poll' | 'linkShare' | 'rtfeedback';

interface SessionData {
  code: string;
  socket: Socket;
  studentName: string;
  activeRooms: RoomType[];
}

const AppSession: React.FC = () => {
  const [session, setSession] = useState<SessionData | null>(null);
  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem('studentName') || '';
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isJoining, setIsJoining] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Apply dark mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const handleJoinSession = async (code: string, name: string) => {
    setIsJoining(true);
    
    try {
      // Check if session exists
      const response = await fetch(`/api/sessions/${code}/exists`);
      const data = await response.json();
      
      if (!data.exists) {
        throw new Error('Session not found');
      }

      // Connect to socket
      const socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', () => reject(new Error('Connection failed')));
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      // Join session
      await new Promise<void>((resolve, reject) => {
        socket.emit('session:join', { code, name, studentId: socket.id });
        
        socket.once('session:joined', (response) => {
          if (response.success) {
            setSession({
              code,
              socket,
              studentName: name,
              activeRooms: response.activeRooms || []
            });
            resolve();
          } else {
            reject(new Error(response.error || 'Failed to join session'));
          }
        });
      });

      // Setup event listeners
      socket.on('session:roomCreated', (data) => {
        setSession(prev => prev ? {
          ...prev,
          activeRooms: [...new Set([...prev.activeRooms, data.roomType])]
        } : null);
      });

      socket.on('session:roomClosed', (data) => {
        setSession(prev => prev ? {
          ...prev,
          activeRooms: prev.activeRooms.filter(rt => rt !== data.roomType)
        } : null);
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from session');
        handleLeaveSession();
      });

    } catch (error) {
      console.error('Failed to join session:', error);
      throw error;
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveSession = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSession(null);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Show session dashboard if joined
  if (session) {
    return (
      <SessionDashboard
        sessionCode={session.code}
        socket={session.socket}
        studentName={session.studentName}
        activeRooms={session.activeRooms}
        onLeave={handleLeaveSession}
      />
    );
  }

  // Show join form
  return (
    <div className={`min-h-screen bg-[#f7f5f2] dark:bg-warm-gray-900 flex items-center justify-center p-4 ${isDarkMode ? 'dark' : ''}`}>
      <div className="w-full max-w-md">
        <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-warm-gray-800 dark:text-warm-gray-100">
              Join Session
            </h1>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-warm-gray-100 dark:bg-warm-gray-700 text-warm-gray-600 dark:text-warm-gray-300 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 transition-colors"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <FaSun /> : <FaMoon />}
            </button>
          </div>
          
          <JoinForm
            onJoin={handleJoinSession}
            defaultName={studentName}
            onNameChange={setStudentName}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
          />
        </div>
      </div>
    </div>
  );
};

export default AppSession;