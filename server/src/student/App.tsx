import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import JoinForm from './components/JoinForm';
import PollActivity from './components/PollActivity';
import DataShareActivity from './components/DataShareActivity';
import './App.css';

export type RoomType = 'poll' | 'dataShare';

interface JoinedRoom {
  id: string;
  code: string;
  type: RoomType;
  studentName: string;
  socket: Socket;
  joinedAt: number;
}

const App: React.FC = () => {
  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([]);
  const [studentName, setStudentName] = useState(() => {
    // Try to get saved name from localStorage
    return localStorage.getItem('studentName') || '';
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage first, then system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isScrolled, setIsScrolled] = useState(false);
  const socketRefs = useRef<Map<string, Socket>>(new Map());
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(180);

  // Save student name to localStorage when it changes
  useEffect(() => {
    if (studentName) {
      localStorage.setItem('studentName', studentName);
    }
  }, [studentName]);

  // Manage dark mode
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  // Handle scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 20); // Trigger after 20px of scrolling
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial scroll position

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Measure header height
  useEffect(() => {
    const measureHeader = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        setHeaderHeight(height);
        // Set CSS variable for spacer
        document.documentElement.style.setProperty('--header-height', `${height}px`);
        
        // Special handling for mobile compact mode
        const isMobile = window.innerWidth <= 640;
        if (isMobile && isScrolled) {
          document.documentElement.style.setProperty('--header-height', '42px');
        }
      }
    };

    measureHeader();
    window.addEventListener('resize', measureHeader);

    return () => {
      window.removeEventListener('resize', measureHeader);
    };
  }, [isScrolled]); // Re-measure when compact state changes

  // Cleanup sockets on unmount
  useEffect(() => {
    return () => {
      socketRefs.current.forEach(socket => socket.close());
    };
  }, []);

  const handleJoin = async (code: string, name: string) => {
    try {
      // Check if already joined this room
      if (joinedRooms.some(room => room.code === code)) {
        throw new Error('Already joined this activity');
      }

      // Update student name if provided
      if (name && name !== studentName) {
        setStudentName(name);
      }

      // Check if room exists
      console.log('Checking if room exists via API...');
      const response = await fetch(`/api/rooms/${code}/exists`);
      const data = await response.json();
      console.log('Room exists API response:', data);
      
      if (!data.exists) {
        throw new Error('Invalid activity code');
      }

      if (!data.roomType) {
        throw new Error('Room configuration error');
      }

      // Create new socket connection for this room
      const newSocket = io();
      const roomId = `${code}-${Date.now()}`;
      
      // Store socket reference
      socketRefs.current.set(roomId, newSocket);

      // Set up socket event handlers
      newSocket.on('connect', () => {
        console.log(`Connected to server for room ${code}`);
        newSocket.emit('room:join', { code, name: name || studentName, type: data.roomType });
      });

      newSocket.on('room:joined', (joinData) => {
        console.log('Received room:joined event:', joinData);
        
        if (joinData.success) {
          const newRoom: JoinedRoom = {
            id: roomId,
            code,
            type: data.roomType,
            studentName: name || studentName,
            socket: newSocket,
            joinedAt: Date.now()
          };
          
          // Add to beginning of array (newest first)
          setJoinedRooms(prev => [newRoom, ...prev]);
        } else {
          // Clean up on failure
          newSocket.close();
          socketRefs.current.delete(roomId);
          throw new Error('Failed to join room');
        }
      });

      newSocket.on('disconnect', () => {
        console.log(`Disconnected from room ${code}`);
      });

    } catch (error) {
      throw error;
    }
  };

  const handleLeaveRoom = (roomId: string) => {
    const socket = socketRefs.current.get(roomId);
    if (socket) {
      socket.close();
      socketRefs.current.delete(roomId);
    }
    
    setJoinedRooms(prev => prev.filter(room => room.id !== roomId));
  };

  return (
    <div className="app-container">
      {/* Sticky header with join form */}
      <div ref={headerRef} className={`join-section ${isScrolled ? 'join-section-compact' : ''}`}>
        <JoinForm 
          onJoin={handleJoin} 
          defaultName={studentName}
          onNameChange={setStudentName}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          isCompact={isScrolled}
        />
      </div>
      
      {/* Spacer to prevent content from going under fixed header */}
      <div className="header-spacer" />

      {/* Joined rooms list */}
      {joinedRooms.length > 0 && (
        <div className="rooms-section">
          <div className="rooms-list">
            {joinedRooms.map((room) => (
              <div key={room.id} className="room-container" data-room-type={room.type}>
                <div className="room-header">
                  <div className="room-info">
                    <span className="room-code-badge">{room.code}</span>
                    <span className="room-type-badge">{room.type === 'poll' ? 'Poll' : 'Data Share'}</span>
                  </div>
                  <button 
                    className="leave-button"
                    onClick={() => handleLeaveRoom(room.id)}
                    aria-label={`Leave activity ${room.code}`}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="room-content">
                  {room.type === 'poll' && (
                    <PollActivity 
                      socket={room.socket} 
                      roomCode={room.code} 
                    />
                  )}
                  {room.type === 'dataShare' && (
                    <DataShareActivity 
                      socket={room.socket} 
                      roomCode={room.code}
                      studentName={studentName}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {joinedRooms.length === 0 && (
        <div className="empty-state">
          <p>No active activities. Enter an activity code above to get started!</p>
        </div>
      )}
    </div>
  );
};

export default App;