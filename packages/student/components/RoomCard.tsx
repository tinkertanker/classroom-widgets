import React from 'react';
import { FaMinus, FaPlus } from 'react-icons/fa6';
import PollActivity from './PollActivity';
import LinkShareActivity from './LinkShareActivity';
import RTFeedbackActivity from './RTFeedbackActivity';
import QuestionsActivity from './QuestionsActivity';
import HandoutActivity from './HandoutActivity';
import { ActivityRenderer } from './activity';
import { isKnownRoomType, resolveRoomMeta } from '../utils/roomTypeMeta';
import type { JoinedRoom } from '../utils/joinedRooms';

interface RoomCardProps {
  room: JoinedRoom;
  studentName: string;
  hostConnected: boolean;
  isMinimized: boolean;
  isEntering: boolean;
  isLeaving: boolean;
  onToggleMinimize: () => void;
}

/** One joined activity: a collapsible header and the room type's activity */
const RoomCard: React.FC<RoomCardProps> = ({
  room,
  studentName,
  hostConnected,
  isMinimized,
  isEntering,
  isLeaving,
  onToggleMinimize
}) => {
  const meta = resolveRoomMeta(room);
  return (
    <div
      className={`bg-soft-white dark:bg-warm-gray-800 rounded-lg overflow-hidden shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 transition-all duration-300 transform-gpu flex-shrink-0 ${
        isLeaving
          ? 'opacity-0 scale-95 -translate-x-full'
          : isEntering
          ? 'opacity-0 scale-95'
          : 'opacity-100 scale-100 translate-x-0'
      }`}
      data-room-type={room.type}
    >
      <div
        className={`flex justify-between items-center px-4 py-2.5 transition-all duration-300 cursor-pointer select-none border-b-2 ${meta.palette.header}`}
        onClick={onToggleMinimize}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleMinimize();
          }
        }}
        aria-expanded={!isMinimized}
        aria-label={`${meta.ariaLabel} - Click to ${isMinimized ? 'expand' : 'collapse'}`}
      >
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className={`text-base md:text-lg font-semibold ${meta.palette.title}`}>
            {meta.label}
          </span>
          <span className="text-warm-gray-600 dark:text-warm-gray-400 text-xs sm:text-sm">
            {meta.description}
          </span>
        </div>
        <div
          className={`${meta.palette.badge} w-6 h-6 rounded-full text-xs transition-all duration-200 flex items-center justify-center pointer-events-none shadow-sm`}
        >
          {isMinimized ? <FaPlus className="w-3 h-3" /> : <FaMinus className="w-3 h-3" />}
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isMinimized ? 'max-h-0' : 'max-h-[500px]'
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
              widgetId={room.widgetId}
            />
          )}
          {room.type === 'linkShare' && (
            <LinkShareActivity
              socket={room.socket}
              roomCode={room.code}
              studentName={studentName}
              widgetId={room.widgetId}
              initialIsActive={room.initialData?.isActive}
              initialAcceptMode={room.initialData?.acceptMode || 'all'}
            />
          )}
          {room.type === 'rtfeedback' && (
            <RTFeedbackActivity
              socket={room.socket}
              roomCode={room.code}
              initialIsActive={room.initialData?.isActive}
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
          {/* A room type this build has no renderer for - see UNKNOWN_ROOM_TYPE_META.
              Say so instead of leaving the card body empty. */}
          {!isKnownRoomType(room.type) && (
            <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400 text-center py-4">
              This activity isn't supported by this version of the app. Try refreshing the page.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
