import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from './services/socket';
import { useRoomAnimations } from './hooks/useRoomAnimations';
import { useSessionRecovery } from './hooks/useSessionRecovery';
import { useCompactHeader } from './hooks/useCompactHeader';
import JoinForm from './components/JoinForm';
import AdminPanel from './components/AdminPanel';
import RoomCard from './components/RoomCard';
import {
  createJoinedRoom,
  roomIdentity,
  upsertJoinedRoom,
  type JoinedRoom,
  type SessionJoinedEvent,
  type SessionRoomCreatedEvent,
  type SessionRoomEvent,
  type SessionRoomSnapshot,
  type SessionWidgetStateChangedEvent
} from './utils/joinedRooms';

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
    try {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {
      // Corrupted localStorage - fall through to system preference
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const { headerRef, isScrolled } = useCompactHeader();
  const [isConnected, setIsConnected] = useState(false);
  const [hostConnected, setHostConnected] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [primarySocket, setPrimarySocket] = useState<Socket | null>(null);
  const socketRefs = useRef<Map<string, Socket>>(new Map());

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
      // Rebuild the list from the server's view of the session. Rooms we already show are
      // updated in place (same identity -> same card id and position, so no duplicate and
      // no remount) and rooms the server no longer reports are dropped.
      const restoredRooms: JoinedRoom[] = (activeRooms as SessionRoomSnapshot[]).map((roomData) => createJoinedRoom({
        code: currentSessionCode,
        roomType: roomData.roomType,
        widgetId: roomData.widgetId,
        data: roomData.room,
        studentName: studentName,
        studentId: primarySocket?.id || '',
        socket: primarySocket!
      }));

      setJoinedRooms(prev => {
        const restoredKeys = new Set(restoredRooms.map(roomIdentity));
        const merged = restoredRooms.reduce((rooms, room) => upsertJoinedRoom(rooms, room), prev);
        return merged.filter(room => restoredKeys.has(roomIdentity(room)));
      });
    },
    onSessionLost: () => {
      setCurrentSessionCode('');
      setJoinedRooms([]);
      setPrimarySocket(null);
      socketRefs.current.clear();
    }
  });


  // Cleanup sockets on unmount
  useEffect(() => {
    return () => {
      socketRefs.current.forEach(socket => socket.close());
    };
  }, []);

  const handleJoin = async (code: string, name: string) => {
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
    if (response.status === 429) {
      throw new Error('Too many attempts. Please wait a moment and try again.');
    }
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

    newSocket.on('session:joined', (joinData: SessionJoinedEvent) => {
      if (joinData.success && joinData.activeRooms) {
        // Set current session code
        setCurrentSessionCode(code);
        setSessionEnded(false);

        // Join all active rooms in the session
        joinData.activeRooms.forEach((roomData) => {
          const newRoom = createJoinedRoom({
            code,
            roomType: roomData.roomType,
            widgetId: roomData.widgetId,
            data: roomData.room,
            studentName: name || studentName,
            studentId: newSocket.id || '', // Populate studentId
            socket: newSocket
          });
          const roomId = newRoom.id;

          // Insert (newest first) or refresh - a reconnect replays this event for every
          // room we already joined, so this must never append blindly
          setJoinedRooms(prev => upsertJoinedRoom(prev, newRoom));

          // Animate room entry. If the room was already in the list it kept its old id,
          // so this freshly-generated roomId matches nothing and no card re-animates.
          animateRoomEnter(roomId);
        });
      } else {
        // Clean up on failure. The reason reaches the join form through
        // joinOutcome below; throwing here would only be an uncaught error.
        newSocket.close();
        socketRefs.current.delete(sessionId);
        setCurrentSessionCode(''); // Clear session code
        setIsConnected(false);
      }
    });

    // Settle the join on the server's first answer so the form can say why
    // it failed (session full, too many attempts, ...)
    const joinOutcome = new Promise<void>((resolve, reject) => {
      const settle = (joinData: { success?: boolean; error?: string; message?: string }) => {
        clearTimeout(timer);
        if (joinData?.success) {
          resolve();
        } else {
          reject(new Error(joinData?.message || joinData?.error || 'Failed to join session'));
        }
      };
      const timer = setTimeout(() => {
        newSocket.off('session:joined', settle);
        newSocket.close();
        socketRefs.current.delete(sessionId);
        setIsConnected(false);
        reject(new Error('Could not connect to the session. Please try again.'));
      }, 15000);
      newSocket.once('session:joined', settle);
    });

    // Handle new rooms being created in the session
    newSocket.on('session:roomCreated', (data: SessionRoomCreatedEvent) => {
      const newRoom = createJoinedRoom({
        code,
        roomType: data.roomType,
        widgetId: data.widgetId,
        data: data.roomData,
        studentName: name || studentName,
        studentId: newSocket.id || '',
        socket: newSocket
      });
      const roomId = newRoom.id;

      // Add room if not already exists
      setJoinedRooms(prev => upsertJoinedRoom(prev, newRoom));

      animateRoomEnter(roomId);
    });

    // Handle rooms being closed in the session
    newSocket.on('session:roomClosed', (data: SessionRoomEvent) => {
      // Find and remove the room of this type for this session
      setJoinedRooms(prev => {
        const roomToRemove = prev.find(r =>
          r.code === code &&
          r.type === data.roomType &&
          r.widgetId === data.widgetId
        );
        if (roomToRemove) {
          animateRoomLeave(roomToRemove.id, () => {
            setJoinedRooms(rooms => rooms.filter(r => r.id !== roomToRemove.id));
          });
        }
        return prev;
      });
    });

    // Handle unified widget state changes
    newSocket.on('session:widgetStateChanged', (data: SessionWidgetStateChangedEvent) => {
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
      // Clear session state
      setJoinedRooms([]);
      setCurrentSessionCode('');
      setSessionEnded(true);
      setHostConnected(true);
      // Close socket connections
      socketRefs.current.forEach((socket) => socket.close());
      socketRefs.current.clear();
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    try {
      await joinOutcome;
    } catch (error) {
      setPrimarySocket(current => (current === newSocket ? null : current));
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
          name={studentName}
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
              <RoomCard
                key={room.id}
                room={room}
                studentName={studentName}
                hostConnected={hostConnected}
                isMinimized={minimizedRooms.has(room.id)}
                isEntering={enteringRooms.has(room.id)}
                isLeaving={leavingRooms.has(room.id)}
                onToggleMinimize={() => toggleMinimizeRoom(room.id)}
              />
            ))}
            </div>
          )}

          {/* Empty state */}
          {joinedRooms.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-warm-gray-600 dark:text-warm-gray-400">
                <p className="text-base">
                  {sessionEnded
                    ? 'Your teacher ended the session. Enter a new code above to join another.'
                    : 'No active session. Enter a session code above to get started!'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
