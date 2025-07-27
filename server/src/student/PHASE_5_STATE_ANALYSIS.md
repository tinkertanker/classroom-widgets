# Phase 5: State Management Analysis

## Current State in App.tsx

1. **joinedRooms**: Complex array of room objects
2. **currentSessionCode**: Simple string
3. **leavingRooms**: Set for animation tracking
4. **enteringRooms**: Set for animation tracking  
5. **minimizedRooms**: Set for UI state
6. **studentName**: String with localStorage
7. **isDarkMode**: Boolean with localStorage
8. **isScrolled**: Boolean for header state
9. **isConnected**: Boolean for connection status
10. **socketRefs**: Ref containing Map of sockets

## Pain Points

### 1. Animation State Management
- `leavingRooms` and `enteringRooms` are tightly coupled
- Multiple `setTimeout` calls to manage animation states
- Easy to get out of sync

### 2. localStorage Management
- Duplicated logic for studentName and isDarkMode
- No central place for persistence

### 3. Room State Complexity
- `joinedRooms` array has complex update logic
- Finding/filtering rooms is verbose
- Animation states are separate from room data

## Proposed Improvements

### Option 1: Extract Animation State (Recommended)
Create a custom hook to manage room animations:

```typescript
// hooks/useRoomAnimations.ts
export const useRoomAnimations = () => {
  const [enteringRooms, setEnteringRooms] = useState<Set<string>>(new Set());
  const [leavingRooms, setLeavingRooms] = useState<Set<string>>(new Set());

  const animateRoomEnter = (roomId: string) => {
    setEnteringRooms(prev => new Set(prev).add(roomId));
    setTimeout(() => {
      setEnteringRooms(prev => {
        const newSet = new Set(prev);
        newSet.delete(roomId);
        return newSet;
      });
    }, 50);
  };

  const animateRoomLeave = (roomId: string, onComplete: () => void) => {
    setLeavingRooms(prev => new Set(prev).add(roomId));
    setTimeout(() => {
      onComplete();
      setLeavingRooms(prev => {
        const newSet = new Set(prev);
        newSet.delete(roomId);
        return newSet;
      });
    }, 300);
  };

  return {
    enteringRooms,
    leavingRooms,
    animateRoomEnter,
    animateRoomLeave
  };
};
```

### Option 2: Extract localStorage Hook
Create a generic localStorage hook:

```typescript
// hooks/useLocalStorage.ts
export const useLocalStorage = <T>(key: string, defaultValue: T) => {
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return defaultValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
};
```

### Option 3: Simplify Room Management
Create helper functions for room operations:

```typescript
// utils/roomHelpers.ts
export const findRoomByTypeAndWidget = (
  rooms: JoinedRoom[], 
  code: string, 
  type: RoomType, 
  widgetId?: string
) => {
  return rooms.find(r => 
    r.code === code && 
    r.type === type && 
    r.widgetId === widgetId
  );
};

export const removeRoom = (
  rooms: JoinedRoom[], 
  roomId: string
) => {
  return rooms.filter(r => r.id !== roomId);
};
```

## Recommendation

**Start with Option 1**: Extract Animation State

Reasons:
1. **Biggest pain point**: Multiple setTimeouts are error-prone
2. **Clear abstraction**: Animation logic is self-contained
3. **Easy to test**: Can test animation timing independently
4. **Low risk**: Doesn't change core functionality
5. **Good ROI**: Reduces complexity significantly

Option 2 is nice-to-have but not critical. Option 3 is minimal benefit for the effort.