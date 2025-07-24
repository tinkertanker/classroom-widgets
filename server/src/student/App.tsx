import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { FaMinus, FaPlus } from 'react-icons/fa6';
import JoinForm from './components/JoinForm';
import PollActivity from './components/PollActivity';
import DataShareActivity from './components/DataShareActivity';
import RTFeedbackActivity from './components/RTFeedbackActivity';
import QuestionsActivity from './components/QuestionsActivity';

export type RoomType = 'poll' | 'dataShare' | 'rtfeedback' | 'questions';

interface JoinedRoom {
  id: string;
  code: string;
  type: RoomType;
  studentName: string;
  socket: Socket;
  joinedAt: number;
  initialData?: any; // Store initial poll/activity data
  widgetId?: string; // Widget instance ID for multiple instances
}

const App: React.FC = () => {
  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([]);
  const [leavingRooms, setLeavingRooms] = useState<Set<string>>(new Set());
  const [enteringRooms, setEnteringRooms] = useState<Set<string>>(new Set());
  const [minimizedRooms, setMinimizedRooms] = useState<Set<string>>(new Set());
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
  
  // Constants for header behavior
  const SCROLL_THRESHOLD_ENTER = 100; // pixels before header becomes compact
  const SCROLL_THRESHOLD_EXIT = 50; // pixels before header exits compact mode (hysteresis)
  const COMPACT_HEADER_HEIGHT_MOBILE = 56; // height in pixels for mobile compact mode
  const DEFAULT_HEADER_HEIGHT = 180; // default height estimate

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


  // Handle scroll state updates with throttling and hysteresis
  useEffect(() => {
    let rafId: number | null = null;
    
    const handleScroll = () => {
      if (rafId) return; // Throttle updates
      
      rafId = requestAnimationFrame(() => {
        const scrollPosition = window.scrollY;
        
        setIsScrolled(prevIsScrolled => {
          // Hysteresis: different thresholds for entering and exiting compact mode
          if (!prevIsScrolled && scrollPosition > SCROLL_THRESHOLD_ENTER) {
            return true; // Enter compact mode
          } else if (prevIsScrolled && scrollPosition < SCROLL_THRESHOLD_EXIT) {
            return false; // Exit compact mode
          }
          return prevIsScrolled; // No change
        });
        
        rafId = null;
      });
    };
    
    // Initial check
    handleScroll();
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // Handle header height measurements with ResizeObserver
  useEffect(() => {
    if (!headerRef.current) return;
    
    const updateHeaderHeight = () => {
      if (!headerRef.current) return;
      
      const height = headerRef.current.offsetHeight;
      const isMobile = window.innerWidth <= 640;
      
      // Apply different heights based on state and device
      const finalHeight = (isMobile && isScrolled) 
        ? COMPACT_HEADER_HEIGHT_MOBILE 
        : height;
        
      document.documentElement.style.setProperty('--header-height', `${finalHeight}px`);
    };
    
    // Use ResizeObserver for accurate measurements
    const resizeObserver = new ResizeObserver(updateHeaderHeight);
    resizeObserver.observe(headerRef.current);
    
    // Also update on window resize for responsive changes
    window.addEventListener('resize', updateHeaderHeight);
    updateHeaderHeight(); // Initial measurement
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [isScrolled]); // Re-measure when scroll state changes

  // Cleanup sockets on unmount
  useEffect(() => {
    return () => {
      socketRefs.current.forEach(socket => socket.close());
    };
  }, []);

  const handleJoin = async (code: string, name: string) => {
    try {
      // Check if already joined this session
      if (joinedRooms.some(room => room.code === code)) {
        throw new Error('Already joined this session');
      }

      // Update student name if provided
      if (name && name !== studentName) {
        setStudentName(name);
      }

      // Check if session exists
      console.log('Checking if session exists via API...');
      const response = await fetch(`/api/sessions/${code}/exists`);
      const data = await response.json();
      console.log('Session exists API response:', data);
      
      if (!data.exists) {
        throw new Error('Invalid session code');
      }

      // Create new socket connection for this session
      const newSocket = io();
      const sessionId = `${code}-${Date.now()}`;
      
      // Store socket reference
      socketRefs.current.set(sessionId, newSocket);

      // Set up socket event handlers
      newSocket.on('connect', () => {
        console.log(`Connected to server for session ${code}`);
        newSocket.emit('session:join', { code, name: name || studentName, studentId: newSocket.id });
      });

      newSocket.on('session:joined', (joinData) => {
        console.log('Received session:joined event:', joinData);
        console.log('Active rooms received:', joinData.activeRooms);
        
        if (joinData.success && joinData.activeRooms) {
          // Join all active rooms in the session
          joinData.activeRooms.forEach((roomData: { roomType: RoomType, widgetId?: string, roomId: string }) => {
            console.log('Creating room for:', roomData);
            const roomId = `${code}-${roomData.roomId}-${Date.now()}`;
            
            const newRoom: JoinedRoom = {
              id: roomId,
              code,
              type: roomData.roomType,
              studentName: name || studentName,
              socket: newSocket,
              joinedAt: Date.now(),
              initialData: {},
              widgetId: roomData.widgetId
            };
            
            // Add to beginning of array (newest first)
            setJoinedRooms(prev => [newRoom, ...prev]);
            
            // Add to entering set for animation
            setEnteringRooms(prev => new Set(prev).add(roomId));
            
            // Remove from entering set after animation
            setTimeout(() => {
              setEnteringRooms(prev => {
                const newSet = new Set(prev);
                newSet.delete(roomId);
                return newSet;
              });
            }, 50); // Short delay to trigger animation
          });
        } else {
          // Clean up on failure
          newSocket.close();
          socketRefs.current.delete(sessionId);
          throw new Error('Failed to join session');
        }
      });

      // Handle new rooms being created in the session
      newSocket.on('session:roomCreated', (data) => {
        console.log('New room created in session:', data);
        const roomId = `${code}-${data.roomId}-${Date.now()}`;
        
        const newRoom: JoinedRoom = {
          id: roomId,
          code,
          type: data.roomType,
          studentName: name || studentName,
          socket: newSocket,
          joinedAt: Date.now(),
          initialData: data.roomData || {},
          widgetId: data.widgetId
        };
        
        // Add room if not already exists
        setJoinedRooms(prev => {
          // Check if this specific widget instance already exists
          if (prev.some(r => r.code === code && r.type === data.roomType && r.widgetId === data.widgetId)) {
            return prev;
          }
          return [newRoom, ...prev];
        });
        
        setEnteringRooms(prev => new Set(prev).add(roomId));
        setTimeout(() => {
          setEnteringRooms(prev => {
            const newSet = new Set(prev);
            newSet.delete(roomId);
            return newSet;
          });
        }, 50);
      });

      // Handle rooms being closed in the session
      newSocket.on('session:roomClosed', (data) => {
        console.log('Room closed in session:', data);
        // Find and remove the room of this type for this session
        setJoinedRooms(prev => {
          const roomToRemove = prev.find(r => 
            r.code === code && 
            r.type === data.roomType && 
            r.widgetId === data.widgetId
          );
          if (roomToRemove) {
            setLeavingRooms(leaving => new Set(leaving).add(roomToRemove.id));
            setTimeout(() => {
              setJoinedRooms(rooms => rooms.filter(r => r.id !== roomToRemove.id));
              setLeavingRooms(leaving => {
                const newSet = new Set(leaving);
                newSet.delete(roomToRemove.id);
                return newSet;
              });
            }, 300);
          }
          return prev;
        });
      });

      newSocket.on('disconnect', () => {
        console.log(`Disconnected from room ${code}`);
      });

    } catch (error) {
      throw error;
    }
  };

  const handleLeaveRoom = (roomId: string) => {
    // Add room to leaving set to trigger animation
    setLeavingRooms(prev => new Set(prev).add(roomId));
    
    // Close socket connection
    const socket = socketRefs.current.get(roomId);
    if (socket) {
      socket.close();
      socketRefs.current.delete(roomId);
    }
    
    // Remove room after animation completes
    setTimeout(() => {
      setJoinedRooms(prev => prev.filter(room => room.id !== roomId));
      setLeavingRooms(prev => {
        const newSet = new Set(prev);
        newSet.delete(roomId);
        return newSet;
      });
    }, 300); // Match animation duration
  };

  const toggleMinimizeRoom = (roomId: string) => {
    setMinimizedRooms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roomId)) {
        newSet.delete(roomId);
      } else {
        newSet.add(roomId);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f5f2] dark:bg-warm-gray-900 font-sans">
      {/* Sticky header with join form */}
      <div 
        ref={headerRef} 
        className={`
          fixed top-0 left-0 right-0 z-[100] 
          bg-soft-white dark:bg-warm-gray-800 rounded-b-lg border border-warm-gray-200 dark:border-warm-gray-700 border-t-0
          transition-all duration-300 ease-in-out
          ${isScrolled 
            ? 'p-2 md:px-4 shadow-md' 
            : 'p-4 shadow-sm'
          }
        `}
      >
        <JoinForm 
          onJoin={handleJoin} 
          defaultName={studentName}
          onNameChange={setStudentName}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          isCompact={isScrolled}
        />
      </div>
      
      {/* Main content wrapper with minimum height */}
      <div className="min-h-screen flex flex-col">
        {/* Spacer to prevent content from going under fixed header */}
        <div 
          style={{ height: 'var(--header-height, 180px)' }} 
          className="transition-[height] duration-300 ease-in-out flex-shrink-0" 
        />

        {/* Content area with flex-grow and minimum height to ensure scrollability */}
        <div 
          className="flex-grow" 
          style={{ 
            minHeight: isScrolled 
              ? `calc(100vh - var(--header-height) + ${SCROLL_THRESHOLD_ENTER + 20}px)` 
              : 'auto'
          }}
        >
          {/* Joined rooms list */}
          {joinedRooms.length > 0 && (
            <div className="mt-4 px-3 pb-4">
              <div className="flex flex-col gap-3 max-w-[800px] mx-auto">
            {joinedRooms.map((room) => (
              <div 
                key={room.id} 
                className={`bg-soft-white dark:bg-warm-gray-800 rounded-lg overflow-hidden shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 transition-all duration-300 transform-gpu ${
                  leavingRooms.has(room.id) 
                    ? 'opacity-0 scale-95 -translate-x-full' 
                    : enteringRooms.has(room.id)
                    ? 'opacity-0 scale-95'
                    : 'opacity-100 scale-100 translate-x-0'
                }`} 
                data-room-type={room.type}
              >
                <div className={`flex justify-between items-center px-4 py-3 ${
                  room.type === 'poll' 
                    ? 'bg-gradient-to-r from-sage-500 to-sage-600 dark:from-sage-700 dark:to-sage-800' 
                    : room.type === 'dataShare' 
                    ? 'bg-gradient-to-r from-terracotta-500 to-terracotta-600 dark:from-terracotta-700 dark:to-terracotta-800' 
                    : room.type === 'rtfeedback' 
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-700 dark:to-amber-800' 
                    : 'bg-gradient-to-r from-sky-500 to-sky-600 dark:from-sky-700 dark:to-sky-800'
                }`}>
                  <div className="flex gap-3 items-center">
                    <span className="text-white text-base md:text-lg font-semibold">
                      {room.type === 'poll' ? 'Poll' : room.type === 'dataShare' ? 'Data Share' : room.type === 'rtfeedback' ? 'RT Feedback' : 'Questions'}
                    </span>
                  </div>
                  <button 
                    className={`${
                      room.type === 'poll' 
                        ? 'bg-sage-700 hover:bg-sage-800 dark:bg-sage-900 dark:hover:bg-sage-950' 
                        : room.type === 'dataShare' 
                        ? 'bg-terracotta-700 hover:bg-terracotta-800 dark:bg-terracotta-900 dark:hover:bg-terracotta-950' 
                        : room.type === 'rtfeedback' 
                        ? 'bg-amber-700 hover:bg-amber-800 dark:bg-amber-900 dark:hover:bg-amber-950' 
                        : 'bg-sky-700 hover:bg-sky-800 dark:bg-sky-900 dark:hover:bg-sky-950'
                    } bg-opacity-50 text-white w-6 h-6 rounded text-xs cursor-pointer transition-all duration-200 flex items-center justify-center`}
                    onClick={() => toggleMinimizeRoom(room.id)}
                    aria-label={minimizedRooms.has(room.id) ? `Expand activity` : `Minimize activity`}
                  >
                    {minimizedRooms.has(room.id) ? <FaPlus className="w-3 h-3" /> : <FaMinus className="w-3 h-3" />}
                  </button>
                </div>
                
                {!minimizedRooms.has(room.id) && (
                  <div className="p-3">
                    {room.type === 'poll' && (
                      <PollActivity 
                        socket={room.socket} 
                        roomCode={room.code}
                        initialPollData={room.initialData}
                        isSession={true}
                        widgetId={room.widgetId}
                      />
                    )}
                    {room.type === 'dataShare' && (
                      <DataShareActivity 
                        socket={room.socket} 
                        roomCode={room.code}
                        studentName={studentName}
                        isSession={true}
                        widgetId={room.widgetId}
                      />
                    )}
                    {room.type === 'rtfeedback' && (
                      <RTFeedbackActivity 
                        socket={room.socket} 
                        roomCode={room.code}
                        studentName={studentName}
                        initialIsActive={room.initialData?.isActive}
                        isSession={true}
                        widgetId={room.widgetId}
                      />
                    )}
                    {room.type === 'questions' && (
                      <QuestionsActivity 
                        socket={room.socket} 
                        sessionCode={room.code}
                        studentId={room.socket.id || ''}
                        widgetId={room.widgetId}
                        initialIsActive={room.initialData?.isActive}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Empty state */}
        {joinedRooms.length === 0 && (
          <div className="text-center py-8 px-3 mt-2 text-warm-gray-600 dark:text-warm-gray-400">
            <p className="text-base">No active sessions. Enter a session code above to get started!</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default App;