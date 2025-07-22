import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import { RoomType } from '../App';
import PollActivity from './PollActivity';
import DataShareActivity from './DataShareActivity';
import RTFeedbackActivity from './RTFeedbackActivity';

interface SessionDashboardProps {
  sessionCode: string;
  socket: Socket;
  studentName: string;
  activeRooms: RoomType[];
  onLeave: () => void;
}

const SessionDashboard: React.FC<SessionDashboardProps> = ({
  sessionCode,
  socket,
  studentName,
  activeRooms,
  onLeave
}) => {
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(
    activeRooms.length === 1 ? activeRooms[0] : null
  );

  const getRoomIcon = (roomType: RoomType) => {
    switch (roomType) {
      case 'poll':
        return '📊';
      case 'dataShare':
        return '🔗';
      case 'rtfeedback':
        return '💭';
      default:
        return '📋';
    }
  };

  const getRoomTitle = (roomType: RoomType) => {
    switch (roomType) {
      case 'poll':
        return 'Poll';
      case 'dataShare':
        return 'Share Links';
      case 'rtfeedback':
        return 'Feedback';
      default:
        return roomType;
    }
  };

  // If only one room is active, show it directly
  if (activeRooms.length === 1 && selectedRoom) {
    return (
      <div className="min-h-screen bg-[#f7f5f2] flex flex-col">
        {/* Compact header */}
        <div className="bg-soft-white border-b border-warm-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedRoom(null)}
              className="text-warm-gray-600 hover:text-warm-gray-800"
            >
              ←
            </button>
            <div>
              <div className="text-sm text-warm-gray-600">Session {sessionCode}</div>
              <div className="font-medium text-warm-gray-800">{getRoomTitle(selectedRoom)}</div>
            </div>
          </div>
          <button
            onClick={onLeave}
            className="text-sm text-dusty-rose-600 hover:text-dusty-rose-700"
          >
            Leave Session
          </button>
        </div>

        {/* Activity content */}
        <div className="flex-1">
          {selectedRoom === 'poll' && (
            <PollActivity
              roomCode={sessionCode}
              socket={socket}
              studentName={studentName}
              isSession={true}
            />
          )}
          {selectedRoom === 'dataShare' && (
            <DataShareActivity
              roomCode={sessionCode}
              socket={socket}
              studentName={studentName}
              isSession={true}
            />
          )}
          {selectedRoom === 'rtfeedback' && (
            <RTFeedbackActivity
              roomCode={sessionCode}
              socket={socket}
              studentName={studentName}
              isSession={true}
            />
          )}
        </div>
      </div>
    );
  }

  // Show room selection
  return (
    <div className="min-h-screen bg-[#f7f5f2] flex flex-col">
      {/* Header */}
      <div className="bg-soft-white border-b border-warm-gray-200 px-4 py-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-semibold text-warm-gray-800">
              Session {sessionCode}
            </h1>
            <button
              onClick={onLeave}
              className="text-sm text-dusty-rose-600 hover:text-dusty-rose-700"
            >
              Leave
            </button>
          </div>
          <p className="text-sm text-warm-gray-600">
            Welcome, {studentName}! Select an activity below.
          </p>
        </div>
      </div>

      {/* Room selection */}
      <div className="flex-1 px-4 py-6">
        <div className="max-w-md mx-auto space-y-3">
          {activeRooms.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-warm-gray-600">
                Waiting for your teacher to start activities...
              </p>
            </div>
          ) : (
            activeRooms.map((roomType) => (
              <button
                key={roomType}
                onClick={() => setSelectedRoom(roomType)}
                className="w-full bg-soft-white hover:bg-warm-gray-50 border border-warm-gray-200 rounded-lg p-4 flex items-center gap-4 transition-colors"
              >
                <div className="text-2xl">{getRoomIcon(roomType)}</div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium text-warm-gray-800">
                    {getRoomTitle(roomType)}
                  </h3>
                  <p className="text-sm text-warm-gray-600">
                    Tap to participate
                  </p>
                </div>
                <div className="text-warm-gray-400">→</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionDashboard;