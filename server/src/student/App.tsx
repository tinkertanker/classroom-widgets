import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { FaMinus, FaPlus } from 'react-icons/fa6';
import { getSocket } from './services/socket';
import { useRoomAnimations } from './hooks/useRoomAnimations';
import { useSessionRecovery } from './hooks/useSessionRecovery';
import JoinForm from './components/JoinForm';
import PollActivity from './components/PollActivity';
import LinkShareActivity from './components/LinkShareActivity';
import RTFeedbackActivity from './components/RTFeedbackActivity';
import QuestionsActivity from './components/QuestionsActivity';
import HandoutActivity from './components/HandoutActivity';
import { ActivityRenderer } from './components/activity';
import AdminPanel from './components/AdminPanel';

export type RoomType = 'poll' | 'linkShare' | 'rtfeedback' | 'questions' | 'handout' | 'activity';

interface JoinedRoom {
  id: string;
  code: string;
  type: RoomType;
  studentName: string;
  studentId: string; // Added studentId to the interface
  socket: Socket;
  joinedAt: number;
  initialData?: any; // Store initial poll/activity data
  widgetId?: string; // Widget instance ID for multiple instances
  isActive: boolean; // Track active state for header styling
}

const App: React.FC = () => {
  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([]);
  const [currentSessionCode, setCurrentSessionCode] = useState<string>(''); // Track current session
  const [minimizedRooms, setMinimizedRooms] = useState<Set<string>>(new Set());
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminSocket, setAdminSocket] = useState<Socket | null>(null);
  const { enteringRooms, leavingRooms, animateRoomEnter, animateRoomLeave, animateAllRoomsLeave } = useRoomAnimations();
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
  const [isConnected, setIsConnected] = useState(false);
  const [hostConnected, setHostConnected] = useState(true);
  const [primarySocket, setPrimarySocket] = useState<Socket | null>(null);
  const socketRefs = useRef<Map<string, Socket>>(new Map());
  const headerRef = useRef<HTMLDivElement>(null);
  
  // Constants for header behavior
  const SCROLL_THRESHOLD_ENTER = 100; // pixels before header becomes compact
  const SCROLL_THRESHOLD_EXIT = 50; // pixels before header exits compact mode (hysteresis)
  const COMPACT_HEADER_HEIGHT_MOBILE = 56; // height in pixels for mobile compact mode
  // const DEFAULT_HEADER_HEIGHT = 180; // default height estimate - unused

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
    setIsDarkMode((prev: boolean) => !prev);
  };
  
  // Session recovery after hot reload
  const { isRecovering } = useSessionRecovery({
    socket: primarySocket,
    sessionCode: currentSessionCode,
    isConnected,
    onSessionRestored: (activeRooms) => {
      // Clear existing rooms first
      setJoinedRooms([]);
      
      // Recreate rooms from recovery data
      activeRooms.forEach((roomData: { roomType: RoomType, widgetId?: string, room?: any }) => {
        const computedRoomId = roomData.widgetId ? `${roomData.roomType}:${roomData.widgetId}` : roomData.roomType;
        const roomId = `${currentSessionCode}-${computedRoomId}-${Date.now()}`;
        const newRoom: JoinedRoom = {
          id: roomId,
          code: currentSessionCode,
          type: roomData.roomType,
          studentName: studentName,
          studentId: primarySocket?.id || '',
          socket: primarySocket!,
          joinedAt: Date.now(),
          initialData: roomData.room || {},
          widgetId: roomData.widgetId,
          isActive: roomData.room?.isActive || false
        };
        setJoinedRooms(prev => [...prev, newRoom]);
      });
    },
    onSessionLost: () => {
      setCurrentSessionCode('');
      setJoinedRooms([]);
      setPrimarySocket(null);
      socketRefs.current.clear();
    }
  });


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
      // Check for admin mode
      if (code.toUpperCase() === 'ADMIN') {
        const socket = getSocket();
        setAdminSocket(socket);
        setIsAdminMode(true);
        return;
      }

      // Check if already joined this session
      if (joinedRooms.some(room => room.code === code)) {
        throw new Error('Already joined this session');
      }

      // Only allow one session at a time
      if (currentSessionCode) {
        throw new Error('You can only join one session at a time. Please leave the current session first.');
      }

      // Update student name if provided
      if (name && name !== studentName) {
        setStudentName(name);
      }

      // Check if session exists
      const response = await fetch(`/api/sessions/${code}/exists`);
      const data = await response.json();

      if (!data.exists) {
        throw new Error('Invalid session code');
      }

      // Create new socket connection for this session
      const newSocket = getSocket();
      const sessionId = `${code}-${Date.now()}`;
      
      // Store socket reference
      socketRefs.current.set(sessionId, newSocket);
      setPrimarySocket(newSocket);

      // Set up socket event handlers
      newSocket.on('connect', () => {
        setIsConnected(true);
        newSocket.emit('session:join', { code, name: name || studentName, studentId: newSocket.id });
      });

      newSocket.on('session:joined', (joinData) => {
        console.log('[Student App] session:joined data:', joinData);
        
        if (joinData.success && joinData.activeRooms) {
          // Set current session code
          setCurrentSessionCode(code);
          
          // Join all active rooms in the session
          joinData.activeRooms.forEach((roomData: { roomType: RoomType, widgetId?: string, room?: any }) => {
            console.log('[Student App] Processing room:', roomData);
            console.log('[Student App] Room data structure:', {
              roomType: roomData.roomType,
              room: roomData.room,
              isActive: roomData.room?.isActive,
              pollData: roomData.room?.pollData,
              fullRoom: JSON.stringify(roomData.room)
            });
            const computedRoomId = roomData.widgetId ? `${roomData.roomType}:${roomData.widgetId}` : roomData.roomType;
            const roomId = `${code}-${computedRoomId}-${Date.now()}`;
            
            const newRoom: JoinedRoom = {
              id: roomId,
              code,
              type: roomData.roomType,
              studentName: name || studentName,
              studentId: newSocket.id || '', // Populate studentId
              socket: newSocket,
              joinedAt: Date.now(),
              initialData: roomData.room || {},
              widgetId: roomData.widgetId,
              isActive: roomData.room?.isActive || false
            };
            
            console.log('[Student App] Created room with isActive:', newRoom.isActive, 'from roomData.room:', roomData.room);
            
            // Add to beginning of array (newest first)
            setJoinedRooms(prev => [newRoom, ...prev]);
            
            // Animate room entry
            animateRoomEnter(roomId);
          });
        } else {
          // Clean up on failure
          newSocket.close();
          socketRefs.current.delete(sessionId);
          setCurrentSessionCode(''); // Clear session code
          setIsConnected(false);
          throw new Error('Failed to join session');
        }
      });

      // Handle new rooms being created in the session
      newSocket.on('session:roomCreated', (data) => {
        const computedRoomId = data.widgetId ? `${data.roomType}:${data.widgetId}` : data.roomType;
        const roomId = `${code}-${computedRoomId}-${Date.now()}`;
        
        const newRoom: JoinedRoom = {
          id: roomId,
          code,
          type: data.roomType,
          studentName: name || studentName,
          studentId: newSocket.id || '',
          socket: newSocket,
          joinedAt: Date.now(),
          initialData: data.roomData || {},
          widgetId: data.widgetId,
          isActive: data.roomData?.isActive || false
        };
        
        // Add room if not already exists
        setJoinedRooms(prev => {
          // Check if this specific widget instance already exists
          if (prev.some(r => r.code === code && r.type === data.roomType && r.widgetId === data.widgetId)) {
            return prev;
          }
          return [newRoom, ...prev];
        });
        
        animateRoomEnter(roomId);
      });

      // Handle rooms being closed in the session
      newSocket.on('session:roomClosed', (data) => {
        console.log('[Student App] Received session:roomClosed:', data);
        // Find and remove the room of this type for this session
        setJoinedRooms(prev => {
          const roomToRemove = prev.find(r => 
            r.code === code && 
            r.type === data.roomType && 
            r.widgetId === data.widgetId
          );
          if (roomToRemove) {
            console.log('[Student App] Found room to remove:', roomToRemove);
            animateRoomLeave(roomToRemove.id, () => {
              console.log('[Student App] Removing room from state:', roomToRemove.id);
              setJoinedRooms(rooms => rooms.filter(r => r.id !== roomToRemove.id));
            });
          } else {
            console.log('[Student App] No matching room found to remove');
          }
          return prev;
        });
      });

      // Handle unified widget state changes
      newSocket.on('session:widgetStateChanged', (data) => {
        // Update the isActive state for the specific widget
        setJoinedRooms(prev => prev.map(room => {
          if (room.code === code && room.type === data.roomType && room.widgetId === data.widgetId) {
            return { 
              ...room, 
              isActive: data.isActive,
              initialData: { ...room.initialData, isActive: data.isActive } 
            };
          }
          return room;
        }));
      });

      // Handle host disconnect/reconnect
      newSocket.on('session:hostDisconnected', () => {
        setHostConnected(false);
      });

      newSocket.on('session:hostReconnected', () => {
        setHostConnected(true);
      });

      // Handle session closed (host disconnected for too long)
      newSocket.on('session:closed', () => {
        console.log('Session closed by server');
        // Clear session state
        setJoinedRooms([]);
        setCurrentSessionCode('');
        setHostConnected(true);
        // Close socket connections
        socketRefs.current.forEach((socket) => socket.close());
        socketRefs.current.clear();
      });
      
      newSocket.on('disconnect', () => {
        setIsConnected(false);
      });
      
      newSocket.on('connect', () => {
        setIsConnected(true);
        // If we were in a session, try to rejoin
        if (currentSessionCode && name) {
          newSocket.emit('session:join', { 
            code: currentSessionCode, 
            name,
            studentId: newSocket.id
          });
        }
      });
      
      newSocket.on('reconnect_attempt', () => {
        // Reconnection attempts are now indicated by the warning icon
      });

    } catch (error) {
      throw error;
    }
  };

  const handleLeaveSession = () => {
    // Animate all rooms leaving
    const roomIds = joinedRooms.map(room => room.id);
    animateAllRoomsLeave(roomIds, () => {
      setJoinedRooms([]);
    });
    
    // Close all socket connections for this session
    socketRefs.current.forEach((socket) => {
      socket.close();
    });
    socketRefs.current.clear();
    
    // Clear current session and connection state
    setCurrentSessionCode('');
    setIsConnected(false);
    setPrimarySocket(null);
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

  const handleCloseAdmin = () => {
    setIsAdminMode(false);
    if (adminSocket) {
      adminSocket.close();
      setAdminSocket(null);
    }
  };

  // Render admin panel if in admin mode
  if (isAdminMode && adminSocket) {
    return <AdminPanel socket={adminSocket} onClose={handleCloseAdmin} />;
  }

  return (
    <div className="min-h-screen bg-[#f7f5f2] dark:bg-warm-gray-900 font-sans flex flex-col">
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
          onLeaveSession={handleLeaveSession}
          currentSessionCode={currentSessionCode}
          defaultName={studentName}
          onNameChange={setStudentName}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          isCompact={isScrolled}
          isConnected={isConnected}
          isRecovering={isRecovering}
        />
      </div>
      
      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col">
        {/* Spacer to prevent content from going under fixed header */}
        <div 
          style={{ height: 'var(--header-height, 180px)' }} 
          className="transition-[height] duration-300 ease-in-out flex-shrink-0" 
        />

        {/* Content area - flexbox container */}
        <div className="flex-1 flex flex-col px-3 py-4">
          {/* Joined rooms list - centered container with flex items */}
          {joinedRooms.length > 0 && (
            <div className="w-full max-w-[800px] mx-auto flex flex-col gap-6 items-stretch">
            {joinedRooms.map((room) => (
              <div 
                key={room.id} 
                className={`bg-soft-white dark:bg-warm-gray-800 rounded-lg overflow-hidden shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 transition-all duration-300 transform-gpu flex-shrink-0 ${
                  leavingRooms.has(room.id) 
                    ? 'opacity-0 scale-95 -translate-x-full' 
                    : enteringRooms.has(room.id)
                    ? 'opacity-0 scale-95'
                    : 'opacity-100 scale-100 translate-x-0'
                }`} 
                data-room-type={room.type}
              >
                <div
                  className={`flex justify-between items-center px-4 py-2.5 transition-all duration-300 cursor-pointer select-none border-b-2 ${
                    !room.isActive
                      ? 'border-warm-gray-400 dark:border-warm-gray-600 bg-warm-gray-100 dark:bg-warm-gray-800'
                      : room.type === 'poll'
                      ? 'border-sage-500 dark:border-sage-400 bg-sage-100 dark:bg-sage-900/30 hover:bg-sage-200 dark:hover:bg-sage-900/40'
                      : room.type === 'linkShare'
                      ? 'border-terracotta-500 dark:border-terracotta-400 bg-terracotta-100 dark:bg-terracotta-900/30 hover:bg-terracotta-200 dark:hover:bg-terracotta-900/40'
                      : room.type === 'rtfeedback'
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/40'
                      : room.type === 'handout'
                      ? 'border-slate-blue-500 dark:border-slate-blue-400 bg-slate-blue-100 dark:bg-slate-blue-900/30 hover:bg-slate-blue-200 dark:hover:bg-slate-blue-900/40'
                      : room.type === 'activity'
                      ? 'border-purple-500 dark:border-purple-400 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/40'
                      : 'border-sky-500 dark:border-sky-400 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-900/40'
                  }`}
                  onClick={() => toggleMinimizeRoom(room.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleMinimizeRoom(room.id);
                    }
                  }}
                  aria-expanded={!minimizedRooms.has(room.id)}
                  aria-label={`${room.type === 'poll' ? 'Poll Activity' : room.type === 'linkShare' ? 'Share Links' : room.type === 'rtfeedback' ? 'Real-Time Feedback' : room.type === 'handout' ? 'Handout' : room.type === 'activity' ? 'Interactive Activity' : 'Ask Questions'} - Click to ${minimizedRooms.has(room.id) ? 'expand' : 'collapse'}`}
                >
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className={`text-base md:text-lg font-semibold ${
                      !room.isActive
                        ? 'text-warm-gray-600 dark:text-warm-gray-400'
                        : room.type === 'poll'
                        ? 'text-sage-700 dark:text-sage-300'
                        : room.type === 'linkShare'
                        ? 'text-terracotta-700 dark:text-terracotta-300'
                        : room.type === 'rtfeedback'
                        ? 'text-amber-700 dark:text-amber-300'
                        : room.type === 'handout'
                        ? 'text-slate-blue-700 dark:text-slate-blue-300'
                        : room.type === 'activity'
                        ? 'text-purple-700 dark:text-purple-300'
                        : 'text-sky-700 dark:text-sky-300'
                    }`}>
                      {room.type === 'poll' ? 'Poll Activity' : room.type === 'linkShare' ? 'Share Links' : room.type === 'rtfeedback' ? 'Real-Time Feedback' : room.type === 'handout' ? 'Handout' : room.type === 'activity' ? (room.initialData?.activity?.title || 'Interactive Activity') : 'Ask Questions'}
                    </span>
                    <span className="text-warm-gray-600 dark:text-warm-gray-400 text-xs sm:text-sm">
                      {room.type === 'poll' ? '' : room.type === 'linkShare' ? '• Share presentation links with your teacher' : room.type === 'rtfeedback' ? '• Adjust the slider to let your teacher know how you\'re doing' : room.type === 'handout' ? '• View content shared by your teacher' : room.type === 'activity' ? (room.initialData?.activity?.instructions ? `• ${room.initialData.activity.instructions}` : '') : '• Submit questions to your teacher'}
                    </span>
                  </div>
                  <div
                    className={`${
                      !room.isActive
                        ? 'bg-warm-gray-500 dark:bg-warm-gray-600 text-white'
                        : room.type === 'poll'
                        ? 'bg-sage-500 dark:bg-sage-600 text-white'
                        : room.type === 'linkShare'
                        ? 'bg-terracotta-500 dark:bg-terracotta-600 text-white'
                        : room.type === 'rtfeedback'
                        ? 'bg-amber-500 dark:bg-amber-600 text-white'
                        : room.type === 'handout'
                        ? 'bg-slate-blue-500 dark:bg-slate-blue-600 text-white'
                        : room.type === 'activity'
                        ? 'bg-purple-500 dark:bg-purple-600 text-white'
                        : 'bg-sky-500 dark:bg-sky-600 text-white'
                    } w-6 h-6 rounded-full text-xs transition-all duration-200 flex items-center justify-center pointer-events-none shadow-sm`}
                  >
                    {minimizedRooms.has(room.id) ? <FaPlus className="w-3 h-3" /> : <FaMinus className="w-3 h-3" />}
                  </div>
                </div>
                
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  minimizedRooms.has(room.id) ? 'max-h-0' : 'max-h-[500px]'
                }`}>
                  <div className="p-3 relative min-h-0">
                    {/* Overlay when teacher is disconnected */}
                    {!hostConnected && (
                      <div className="absolute inset-0 bg-warm-gray-900/80 dark:bg-warm-gray-950/80 rounded-md flex items-center justify-center z-10">
                        <div className="text-center text-white p-4">
                          <div className="text-lg font-semibold mb-2">Activity Paused</div>
                          <div className="text-sm opacity-80">Waiting for teacher to reconnect...</div>
                        </div>
                      </div>
                    )}
                    
                    {room.type === 'poll' && (
                      <PollActivity 
                        socket={room.socket} 
                        roomCode={room.code}
                        initialPollData={room.initialData?.pollData}
                        initialIsActive={room.isActive}
                        isSession={true}
                        widgetId={room.widgetId}
                      />
                    )}
                    {room.type === 'linkShare' && (
                      <LinkShareActivity
                        socket={room.socket}
                        roomCode={room.code}
                        studentName={studentName}
                        isSession={true}
                        widgetId={room.widgetId}
                        initialIsActive={room.initialData?.isActive}
                        initialAcceptMode={room.initialData?.acceptMode || 'all'}
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
                        studentId={room.studentId || ''}
                        studentName={room.studentName}
                        widgetId={room.widgetId}
                        initialIsActive={room.initialData?.isActive}
                      />
                    )}
                    {room.type === 'handout' && (
                      <HandoutActivity
                        socket={room.socket}
                        roomCode={room.code}
                        isSession={true}
                        widgetId={room.widgetId}
                        initialIsActive={room.initialData?.isActive}
                        initialItems={room.initialData?.items || []}
                      />
                    )}
                    {room.type === 'activity' && (
                      <ActivityRenderer
                        socket={room.socket}
                        sessionCode={room.code}
                        widgetId={room.widgetId}
                        initialActivity={room.initialData?.activity}
                        initialIsActive={room.initialData?.isActive}
                        initialActions={room.initialData?.actions || []}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}

          {/* Empty state */}
          {joinedRooms.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-warm-gray-600 dark:text-warm-gray-400">
                <p className="text-base">No active session. Enter a session code above to get started!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;