import React from 'react';
import { FaMinus, FaPlus } from 'react-icons/fa6';
import { ActivityCardProps } from '../../types/ui.types';
import { Card } from '../common';
import { useUIStore } from '../../store/uiStore';

const ActivityCard: React.FC<ActivityCardProps & { roomId: string }> = ({
  title,
  description,
  icon: Icon,
  isMinimized,
  onToggleMinimize,
  children,
  variant,
  roomId
}) => {
  const { enteringRooms, leavingRooms } = useUIStore();
  
  const gradients = {
    poll: 'bg-gradient-to-r from-sage-500 to-sage-600 dark:from-sage-700 dark:to-sage-800',
    linkShare: 'bg-gradient-to-r from-terracotta-500 to-terracotta-600 dark:from-terracotta-700 dark:to-terracotta-800',
    rtfeedback: 'bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-700 dark:to-amber-800',
    questions: 'bg-gradient-to-r from-sky-500 to-sky-600 dark:from-sky-700 dark:to-sky-800'
  };
  
  const buttonColors = {
    poll: 'bg-sage-700 hover:bg-sage-800 dark:bg-sage-900 dark:hover:bg-sage-950',
    linkShare: 'bg-terracotta-700 hover:bg-terracotta-800 dark:bg-terracotta-900 dark:hover:bg-terracotta-950',
    rtfeedback: 'bg-amber-700 hover:bg-amber-800 dark:bg-amber-900 dark:hover:bg-amber-950',
    questions: 'bg-sky-700 hover:bg-sky-800 dark:bg-sky-900 dark:hover:bg-sky-950'
  };
  
  const isEntering = enteringRooms.has(roomId);
  const isLeaving = leavingRooms.has(roomId);
  
  return (
    <Card 
      padding="none"
      className={`
        transition-all duration-300 transform-gpu
        ${isLeaving ? 'opacity-0 scale-95 -translate-x-full' : ''}
        ${isEntering ? 'opacity-0 scale-95' : 'opacity-100 scale-100 translate-x-0'}
      `}
    >
      <div className={`flex justify-between items-center px-4 py-3 ${gradients[variant]}`}>
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <div className="flex items-center gap-2">
            <Icon className="text-white text-lg" />
            <span className="text-white text-base md:text-lg font-semibold">
              {title}
            </span>
          </div>
          {description && (
            <span className="text-white/80 text-xs sm:text-sm">
              • {description}
            </span>
          )}
        </div>
        <button 
          className={`${buttonColors[variant]} bg-opacity-50 text-white w-6 h-6 rounded text-xs cursor-pointer transition-all duration-200 flex items-center justify-center`}
          onClick={onToggleMinimize}
          aria-label={isMinimized ? 'Expand activity' : 'Minimize activity'}
        >
          {isMinimized ? <FaPlus className="w-3 h-3" /> : <FaMinus className="w-3 h-3" />}
        </button>
      </div>
      
      {!isMinimized && (
        <div className="p-3">
          {children}
        </div>
      )}
    </Card>
  );
};

export default ActivityCard;