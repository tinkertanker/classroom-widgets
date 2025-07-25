import React, { useState, useEffect, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { FaMinus, FaPlus } from 'react-icons/fa6';
import JoinForm from './components/JoinForm';
import { ActivityRenderer } from './components/ActivityRenderer';
import { ActivityRoomType } from './types/activity.types';
import { getNetworkedWidgets } from '../../constants/widgetRegistry';

// Get display name for room type
const getRoomDisplayName = (roomType: ActivityRoomType): string => {
  const widgetDef = getNetworkedWidgets().find(w => w.networked?.roomType === roomType);
  return widgetDef?.displayName || roomType;
};

// Get gradient colors for room type
const getRoomGradientColors = (roomType: ActivityRoomType): string => {
  const gradients = {
    poll: 'bg-gradient-to-r from-sage-500 to-sage-600 dark:from-sage-700 dark:to-sage-800',
    linkShare: 'bg-gradient-to-r from-terracotta-500 to-terracotta-600 dark:from-terracotta-700 dark:to-terracotta-800',
    rtfeedback: 'bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-700 dark:to-amber-800',
    questions: 'bg-gradient-to-r from-sky-500 to-sky-600 dark:from-sky-700 dark:to-sky-800'
  };
  return gradients[roomType] || 'bg-warm-gray-600 dark:bg-warm-gray-700';
};

// Get minimize button colors for room type
const getRoomMinimizeButtonColors = (roomType: ActivityRoomType): string => {
  const colors = {
    poll: 'bg-sage-700 hover:bg-sage-800 dark:bg-sage-900 dark:hover:bg-sage-950',
    linkShare: 'bg-terracotta-700 hover:bg-terracotta-800 dark:bg-terracotta-900 dark:hover:bg-terracotta-950',
    rtfeedback: 'bg-amber-700 hover:bg-amber-800 dark:bg-amber-900 dark:hover:bg-amber-950',
    questions: 'bg-sky-700 hover:bg-sky-800 dark:bg-sky-900 dark:hover:bg-sky-950'
  };
  return colors[roomType] || 'bg-warm-gray-700 hover:bg-warm-gray-800';
};

interface JoinedRoom {
  id: string;
  code: string;
  type: ActivityRoomType;
  studentName: string;
  socket: Socket;
  joinedAt: number;
  initialData?: any;
  widgetId?: string;
}

const AppRefactored: React.FC = () => {
  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([]);
  const [leavingRooms, setLeavingRooms] = useState<Set<string>>(new Set());
  const [enteringRooms, setEnteringRooms] = useState<Set<string>>(new Set());
  const [minimizedRooms, setMinimizedRooms] = useState<Set<string>>(new Set());
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
  const [isScrolled, setIsScrolled] = useState(false);
  const socketRefs = useRef<Map<string, Socket>>(new Map());
  const headerRef = useRef<HTMLDivElement>(null);

  // Save student name to localStorage
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

  // Handle scroll state
  useEffect(() => {
    let rafId: number | null = null;
    
    const handleScroll = () => {
      if (rafId) return;
      
      rafId = requestAnimationFrame(() => {
        const scrollPosition = window.scrollY;
        setIsScrolled(scrollPosition > 100);
        rafId = null;
      });
    };
    
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Update header height CSS variable
  useEffect(() => {
    if (!headerRef.current) return;
    
    const updateHeaderHeight = () => {
      if (!headerRef.current) return;
      const height = headerRef.current.offsetHeight;
      document.documentElement.style.setProperty('--header-height', `${height}px`);
    };
    
    const resizeObserver = new ResizeObserver(updateHeaderHeight);
    resizeObserver.observe(headerRef.current);
    window.addEventListener('resize', updateHeaderHeight);
    updateHeaderHeight();
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [isScrolled]);

  // Cleanup sockets on unmount
  useEffect(() => {
    return () => {
      socketRefs.current.forEach(socket => socket.close());
    };
  }, []);

  // Handle room lifecycle events
  const handleRoomEvent = useCallback((
    eventType: 'created' | 'closed',
    sessionCode: string,
    data: any
  ) => {
    if (eventType === 'created') {
      const roomId = `${sessionCode}-${data.roomId}-${Date.now()}`;
      const sessionSocket = Array.from(socketRefs.current.values())
        .find(s => s.io.opts.query?.sessionCode === sessionCode);
      
      if (!sessionSocket) return;

      const newRoom: JoinedRoom = {
        id: roomId,
        code: sessionCode,
        type: data.roomType,
        studentName,
        socket: sessionSocket,
        joinedAt: Date.now(),
        initialData: data.roomData || {},
        widgetId: data.widgetId
      };
      
      setJoinedRooms(prev => {
        // Check if already exists
        if (prev.some(r => r.code === sessionCode && r.type === data.roomType && r.widgetId === data.widgetId)) {
          return prev;
        }
        return [newRoom, ...prev];
      });
      
      // Animate entry
      setEnteringRooms(prev => new Set(prev).add(roomId));
      setTimeout(() => {
        setEnteringRooms(prev => {
          const newSet = new Set(prev);
          newSet.delete(roomId);
          return newSet;
        });
      }, 50);
    } else if (eventType === 'closed') {
      // Find and remove room
      setJoinedRooms(prev => {
        const roomToRemove = prev.find(r => 
          r.code === sessionCode && 
          r.type === data.roomType && 
          r.widgetId === data.widgetId
        );
        
        if (roomToRemove) {
          // Animate exit
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
    }
  }, [studentName]);

  // Handle joining a session
  const handleJoin = async (code: string, name: string) => {
    try {
      // Check if already joined
      if (joinedRooms.some(room => room.code === code)) {
        throw new Error('Already joined this session');
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

      // Create new socket connection
      const newSocket = io({
        query: { sessionCode: code }
      });
      const socketId = `socket-${Date.now()}`;
      socketRefs.current.set(socketId, newSocket);

      // Setup socket event handlers
      newSocket.on('connect', () => {
        console.log(`Connected to server for session ${code}`);
        newSocket.emit('session:join', { 
          code, 
          name: name || studentName, 
          studentId: newSocket.id 
        });
      });

      newSocket.on('session:joined', (joinData) => {
        if (joinData.success && joinData.activeRooms) {
          // Add all active rooms
          joinData.activeRooms.forEach((roomData: any) => {
            handleRoomEvent('created', code, roomData);
          });
        } else {
          // Clean up on failure
          newSocket.close();
          socketRefs.current.delete(socketId);
          throw new Error('Failed to join session');
        }
      });

      // Handle new rooms being created
      newSocket.on('session:roomCreated', (data) => {
        handleRoomEvent('created', code, data);
      });

      // Handle rooms being closed
      newSocket.on('session:roomClosed', (data) => {
        handleRoomEvent('closed', code, data);
      });

      newSocket.on('disconnect', () => {
        console.log(`Disconnected from session ${code}`);
      });

    } catch (error) {
      throw error;
    }
  };

  // Toggle minimize state for a room
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
      {/* Sticky header */}
      <div 
        ref={headerRef} 
        className={`fixed top-0 left-0 right-0 z-[100] bg-soft-white dark:bg-warm-gray-800 rounded-b-lg border border-warm-gray-200 dark:border-warm-gray-700 border-t-0 transition-all duration-300 ease-in-out ${
          isScrolled ? 'p-3 md:px-6 shadow-md' : 'p-6 shadow-sm'
        }`}
      >
        <JoinForm 
          onJoin={handleJoin} 
          defaultName={studentName}
          onNameChange={setStudentName}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          isCompact={isScrolled}
        />
      </div>
      
      {/* Main content */}
      <div className="min-h-screen flex flex-col">
        <div style={{ height: 'var(--header-height, 180px)' }} className="transition-[height] duration-300 ease-in-out flex-shrink-0" />

        <div className="flex-grow">
          {/* Joined rooms */}
          {joinedRooms.length > 0 && (
            <div className="mt-8 px-4 pb-8">
              <div className="flex flex-col gap-4 max-w-[800px] mx-auto">
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
                  >
                    {/* Room header */}
                    <div className={`flex justify-between items-center px-6 py-4 ${getRoomGradientColors(room.type)}`}>
                      <div className="flex gap-3 items-center">
                        <span className="text-white text-base md:text-lg font-semibold">
                          {getRoomDisplayName(room.type)}
                        </span>
                      </div>
                      <button 
                        className={`${getRoomMinimizeButtonColors(room.type)} bg-opacity-50 text-white w-6 h-6 rounded text-xs cursor-pointer transition-all duration-200 flex items-center justify-center`}
                        onClick={() => toggleMinimizeRoom(room.id)}
                        aria-label={minimizedRooms.has(room.id) ? 'Expand activity' : 'Minimize activity'}
                      >
                        {minimizedRooms.has(room.id) ? <FaPlus className="w-3 h-3" /> : <FaMinus className="w-3 h-3" />}
                      </button>
                    </div>
                    
                    {/* Room content */}
                    {!minimizedRooms.has(room.id) && (
                      <div className="p-4">
                        <ActivityRenderer
                          type={room.type}
                          socket={room.socket}
                          sessionCode={room.code}
                          widgetId={room.widgetId}
                          studentName={room.studentName}
                          initialData={room.initialData}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {joinedRooms.length === 0 && (
            <div className="text-center py-12 px-4 mt-4 text-warm-gray-600 dark:text-warm-gray-400">
              <p className="text-base">No active sessions. Enter a session code above to get started!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppRefactored;