import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Toast } from '../types/ui.types';

interface UIState {
  // Theme
  isDarkMode: boolean;
  
  // UI state
  minimizedRooms: Set<string>;
  isScrolled: boolean;
  headerHeight: number;
  
  // Animations
  enteringRooms: Set<string>;
  leavingRooms: Set<string>;
  
  // Toast notifications
  toasts: Toast[];
  
  // Actions
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  toggleMinimizeRoom: (roomId: string) => void;
  setScrolled: (isScrolled: boolean) => void;
  setHeaderHeight: (height: number) => void;
  addEnteringRoom: (roomId: string) => void;
  removeEnteringRoom: (roomId: string) => void;
  addLeavingRoom: (roomId: string) => void;
  removeLeavingRoom: (roomId: string) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

let toastId = 0;

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
        minimizedRooms: new Set(),
        isScrolled: false,
        headerHeight: 180,
        enteringRooms: new Set(),
        leavingRooms: new Set(),
        toasts: [],
        
        // Actions
        toggleDarkMode: () => {
          set((state) => {
            const newMode = !state.isDarkMode;
            if (newMode) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
            return { isDarkMode: newMode };
          });
        },
        
        setDarkMode: (isDark) => {
          if (isDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          set({ isDarkMode: isDark });
        },
        
        toggleMinimizeRoom: (roomId) => {
          set((state) => {
            const newSet = new Set(state.minimizedRooms);
            if (newSet.has(roomId)) {
              newSet.delete(roomId);
            } else {
              newSet.add(roomId);
            }
            return { minimizedRooms: newSet };
          });
        },
        
        setScrolled: (isScrolled) => set({ isScrolled }),
        
        setHeaderHeight: (height) => {
          document.documentElement.style.setProperty('--header-height', `${height}px`);
          set({ headerHeight: height });
        },
        
        addEnteringRoom: (roomId) => {
          set((state) => ({
            enteringRooms: new Set([...state.enteringRooms, roomId])
          }));
          
          // Auto-remove after animation
          setTimeout(() => {
            get().removeEnteringRoom(roomId);
          }, 300);
        },
        
        removeEnteringRoom: (roomId) => {
          set((state) => {
            const newSet = new Set(state.enteringRooms);
            newSet.delete(roomId);
            return { enteringRooms: newSet };
          });
        },
        
        addLeavingRoom: (roomId) => {
          set((state) => ({
            leavingRooms: new Set([...state.leavingRooms, roomId])
          }));
          
          // Auto-remove after animation
          setTimeout(() => {
            get().removeLeavingRoom(roomId);
          }, 300);
        },
        
        removeLeavingRoom: (roomId) => {
          set((state) => {
            const newSet = new Set(state.leavingRooms);
            newSet.delete(roomId);
            return { leavingRooms: newSet };
          });
        },
        
        addToast: (toast) => {
          const id = `toast-${++toastId}`;
          const newToast = { ...toast, id };
          
          set((state) => ({
            toasts: [...state.toasts, newToast]
          }));
          
          // Auto-remove after duration
          if (toast.duration !== 0) {
            setTimeout(() => {
              get().removeToast(id);
            }, toast.duration || 5000);
          }
        },
        
        removeToast: (id) => {
          set((state) => ({
            toasts: state.toasts.filter(t => t.id !== id)
          }));
        }
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({ 
          isDarkMode: state.isDarkMode,
          minimizedRooms: Array.from(state.minimizedRooms)
        })
      }
    )
  )
);