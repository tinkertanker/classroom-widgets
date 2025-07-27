import { useState } from 'react';

interface UseRoomAnimationsReturn {
  enteringRooms: Set<string>;
  leavingRooms: Set<string>;
  animateRoomEnter: (roomId: string) => void;
  animateRoomLeave: (roomId: string, onComplete: () => void) => void;
  animateAllRoomsLeave: (roomIds: string[], onComplete: () => void) => void;
}

/**
 * Custom hook to manage room entry/exit animations
 * Centralizes all animation timing logic
 */
export const useRoomAnimations = (): UseRoomAnimationsReturn => {
  const [enteringRooms, setEnteringRooms] = useState<Set<string>>(new Set());
  const [leavingRooms, setLeavingRooms] = useState<Set<string>>(new Set());

  const animateRoomEnter = (roomId: string) => {
    // Add to entering set
    setEnteringRooms(prev => new Set(prev).add(roomId));
    
    // Remove after animation starts
    setTimeout(() => {
      setEnteringRooms(prev => {
        const newSet = new Set(prev);
        newSet.delete(roomId);
        return newSet;
      });
    }, 50); // Short delay to trigger CSS animation
  };

  const animateRoomLeave = (roomId: string, onComplete: () => void) => {
    // Add to leaving set
    setLeavingRooms(prev => new Set(prev).add(roomId));
    
    // Execute callback and cleanup after animation
    setTimeout(() => {
      onComplete();
      setLeavingRooms(prev => {
        const newSet = new Set(prev);
        newSet.delete(roomId);
        return newSet;
      });
    }, 300); // Match CSS animation duration
  };

  const animateAllRoomsLeave = (roomIds: string[], onComplete: () => void) => {
    // Add all rooms to leaving set
    setLeavingRooms(prev => new Set([...prev, ...roomIds]));
    
    // Execute callback and cleanup after animation
    setTimeout(() => {
      onComplete();
      setLeavingRooms(new Set()); // Clear all
    }, 300); // Match CSS animation duration
  };

  return {
    enteringRooms,
    leavingRooms,
    animateRoomEnter,
    animateRoomLeave,
    animateAllRoomsLeave
  };
};