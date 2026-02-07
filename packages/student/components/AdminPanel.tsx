import React, { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { FaArrowsRotate, FaXmark, FaUsers, FaChartBar, FaComments, FaLink, FaCircleQuestion } from 'react-icons/fa6';

interface Participant {
  name: string;
  joinedAt: number;
}

interface RoomInfo {
  roomType: string;
  widgetId?: string;
  isActive: boolean;
  pollQuestion?: string;
  totalVotes?: number;
  questionCount?: number;
  submissionCount?: number;
  responseCount?: number;
}

interface SessionInfo {
  code: string;
  createdAt: number;
  lastActivity: number;
  hasHost: boolean;
  participantCount: number;
  participants: Participant[];
  activeRooms: RoomInfo[];
}

interface Stats {
  activeSessions: number;
  totalParticipants: number;
  totalRooms: number;
}

interface AdminPanelProps {
  socket: Socket;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ socket, onClose }) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchSessions = useCallback(() => {
    setIsLoading(true);
    setError('');

    socket.emit('admin:getSessions', {}, (response: { success: boolean; sessions?: SessionInfo[]; stats?: Stats; error?: string }) => {
      setIsLoading(false);
      if (response.success && response.sessions) {
        setSessions(response.sessions);
        setStats(response.stats || null);
        setLastRefresh(new Date());
      } else {
        setError(response.error || 'Failed to fetch sessions');
      }
    });
  }, [socket]);

  useEffect(() => {
    fetchSessions();

    // Subscribe to real-time updates
    socket.emit('admin:subscribe');

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchSessions, 10000);

    return () => {
      clearInterval(interval);
      socket.emit('admin:unsubscribe');
    };
  }, [socket, fetchSessions]);

  const toggleExpanded = (code: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    }
    return `${minutes}m ago`;
  };

  const getRoomIcon = (roomType: string) => {
    switch (roomType) {
      case 'poll': return <FaChartBar className="w-3 h-3" />;
      case 'questions': return <FaCircleQuestion className="w-3 h-3" />;
      case 'linkShare': return <FaLink className="w-3 h-3" />;
      case 'rtfeedback': return <FaComments className="w-3 h-3" />;
      default: return null;
    }
  };

  const getRoomLabel = (roomType: string) => {
    switch (roomType) {
      case 'poll': return 'Poll';
      case 'questions': return 'Questions';
      case 'linkShare': return 'Link Share';
      case 'rtfeedback': return 'Feedback';
      default: return roomType;
    }
  };

  return (
    <div className="min-h-screen bg-warm-gray-100 dark:bg-warm-gray-900 p-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-warm-gray-800 dark:text-warm-gray-200">
                Admin Dashboard
              </h1>
              {lastRefresh && (
                <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-1">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchSessions}
                disabled={isLoading}
                className="p-2 rounded-md bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300 hover:bg-sage-200 dark:hover:bg-sage-900/50 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <FaArrowsRotate className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-md bg-warm-gray-100 dark:bg-warm-gray-700 text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 transition-colors"
                title="Close Admin Panel"
              >
                <FaXmark className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-sage-600 dark:text-sage-400">{stats.activeSessions}</div>
              <div className="text-xs text-warm-gray-500 dark:text-warm-gray-400">Active Sessions</div>
            </div>
            <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{stats.totalParticipants}</div>
              <div className="text-xs text-warm-gray-500 dark:text-warm-gray-400">Total Participants</div>
            </div>
            <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-terracotta-600 dark:text-terracotta-400">{stats.totalRooms}</div>
              <div className="text-xs text-warm-gray-500 dark:text-warm-gray-400">Active Widgets</div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-dusty-rose-50 dark:bg-dusty-rose-900/30 text-dusty-rose-700 dark:text-dusty-rose-300 p-3 rounded-md text-sm mb-4 border border-dusty-rose-200 dark:border-dusty-rose-700">
            {error}
          </div>
        )}

        {/* Sessions List */}
        <div className="space-y-3">
          {sessions.length === 0 && !isLoading ? (
            <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 p-8 text-center">
              <p className="text-warm-gray-500 dark:text-warm-gray-400">No active sessions</p>
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.code}
                className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 overflow-hidden"
              >
                {/* Session Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50 transition-colors"
                  onClick={() => toggleExpanded(session.code)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200">
                        {session.code}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        session.hasHost
                          ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      }`}>
                        {session.hasHost ? 'Host Connected' : 'No Host'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-warm-gray-500 dark:text-warm-gray-400">
                      <span className="flex items-center gap-1">
                        <FaUsers className="w-3 h-3" />
                        {session.participantCount}
                      </span>
                      <span>{session.activeRooms.length} widgets</span>
                      <span>Active {formatDuration(session.lastActivity)}</span>
                    </div>
                  </div>

                  {/* Room badges */}
                  {session.activeRooms.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {session.activeRooms.map((room, idx) => (
                        <span
                          key={`${room.roomType}-${room.widgetId || idx}`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                            room.isActive
                              ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300'
                              : 'bg-warm-gray-100 dark:bg-warm-gray-700 text-warm-gray-600 dark:text-warm-gray-400'
                          }`}
                        >
                          {getRoomIcon(room.roomType)}
                          {getRoomLabel(room.roomType)}
                          {!room.isActive && ' (paused)'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedSessions.has(session.code) && (
                  <div className="border-t border-warm-gray-200 dark:border-warm-gray-700 p-4 bg-warm-gray-50 dark:bg-warm-gray-900/50">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <h4 className="font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">Session Info</h4>
                        <div className="space-y-1 text-warm-gray-600 dark:text-warm-gray-400">
                          <p>Created: {formatTime(session.createdAt)} ({formatDuration(session.createdAt)})</p>
                          <p>Last Activity: {formatTime(session.lastActivity)}</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
                          Participants ({session.participantCount})
                        </h4>
                        {session.participants.length > 0 ? (
                          <ul className="space-y-1 text-warm-gray-600 dark:text-warm-gray-400 max-h-32 overflow-y-auto">
                            {session.participants.map((p, idx) => (
                              <li key={idx} className="flex items-center justify-between">
                                <span>{p.name || 'Anonymous'}</span>
                                <span className="text-xs text-warm-gray-400 dark:text-warm-gray-500">
                                  {formatDuration(p.joinedAt)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-warm-gray-400 dark:text-warm-gray-500">No participants</p>
                        )}
                      </div>
                    </div>

                    {/* Widget Details */}
                    {session.activeRooms.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">Widget Details</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {session.activeRooms.map((room, idx) => (
                            <div
                              key={`${room.roomType}-${room.widgetId || idx}`}
                              className="p-2 rounded bg-soft-white dark:bg-warm-gray-800 border border-warm-gray-200 dark:border-warm-gray-700"
                            >
                              <div className="flex items-center gap-2 text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
                                {getRoomIcon(room.roomType)}
                                {getRoomLabel(room.roomType)}
                              </div>
                              <div className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-1">
                                {room.roomType === 'poll' && room.pollQuestion && (
                                  <p className="truncate">Q: {room.pollQuestion}</p>
                                )}
                                {room.roomType === 'poll' && room.totalVotes !== undefined && (
                                  <p>{room.totalVotes} votes</p>
                                )}
                                {room.roomType === 'questions' && (
                                  <p>{room.questionCount || 0} questions</p>
                                )}
                                {room.roomType === 'linkShare' && (
                                  <p>{room.submissionCount || 0} submissions</p>
                                )}
                                {room.roomType === 'rtfeedback' && (
                                  <p>{room.responseCount || 0} responses</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
