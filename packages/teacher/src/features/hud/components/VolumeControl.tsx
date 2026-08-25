import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { FaVolumeHigh, FaVolumeLow, FaVolumeXmark } from 'react-icons/fa6';
import { hudContainer, zIndex } from '@shared/utils/styles';
import { useAudioVolumeStore } from '../../../store/audioVolumeStore';

interface VolumeControlProps {
  avoidSessionBanner?: boolean;
}

const HOVER_CLOSE_DELAY_MS = 500;

const VolumeControl: React.FC<VolumeControlProps> = ({ avoidSessionBanner = false }) => {
  const volume = useAudioVolumeStore((state) => state.volume);
  const setVolume = useAudioVolumeStore((state) => state.setVolume);
  const toggleMuted = useAudioVolumeStore((state) => state.toggleMuted);
  const [isOpen, setIsOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const suppressFocusOpenRef = useRef(false);
  const isHoveredRef = useRef(false);
  const isFocusWithinRef = useRef(false);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingHoverClose = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const openOnHover = () => {
    isHoveredRef.current = true;
    cancelPendingHoverClose();
    setIsOpen(true);
  };

  const closeAfterHover = () => {
    isHoveredRef.current = false;
    cancelPendingHoverClose();
    if (isFocusWithinRef.current) return;

    hoverCloseTimerRef.current = setTimeout(() => {
      hoverCloseTimerRef.current = null;
      setIsOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  };

  useEffect(() => () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        suppressFocusOpenRef.current = true;
        buttonRef.current?.focus();
        suppressFocusOpenRef.current = false;
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [isOpen]);

  const VolumeIcon = volume === 0
    ? FaVolumeXmark
    : volume < 0.5
      ? FaVolumeLow
      : FaVolumeHigh;
  const volumePercent = Math.round(volume * 100);

  return (
    <div
      ref={controlRef}
      className="relative pointer-events-auto shrink-0"
      onMouseEnter={openOnHover}
      onMouseLeave={closeAfterHover}
      onFocusCapture={() => {
        isFocusWithinRef.current = true;
        if (!suppressFocusOpenRef.current) {
          cancelPendingHoverClose();
          setIsOpen(true);
        }
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          isFocusWithinRef.current = false;
          if (!isHoveredRef.current) {
            setIsOpen(false);
          }
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={clsx(
          hudContainer.button,
          'w-10 px-0',
          volume === 0
            ? 'text-dusty-rose-600 dark:text-dusty-rose-400'
            : 'text-warm-gray-700 dark:text-warm-gray-200',
          isOpen && 'ring-2 ring-sage-500 ring-offset-1 dark:ring-offset-warm-gray-900'
        )}
        onClick={toggleMuted}
        title={volume === 0 ? 'Unmute app sounds' : 'Mute app sounds'}
        aria-label={volume === 0 ? 'Unmute app sounds' : 'Mute app sounds'}
        aria-expanded={isOpen}
        aria-controls="app-volume-slider"
      >
        <VolumeIcon className="text-lg" />
      </button>

      <div
        className={clsx(
          'absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded-lg border border-warm-gray-300/50 bg-soft-white/90 px-3 py-3 shadow-lg backdrop-blur-sm dark:border-warm-gray-600/50 dark:bg-warm-gray-800/90',
          avoidSessionBanner && 'max-[540px]:mt-16',
          zIndex.hudDropdown,
          'transition-all duration-200 origin-top',
          isOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : '-translate-y-2 opacity-0 pointer-events-none'
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex h-36 w-10 flex-col items-center justify-between gap-2">
          <span className="text-xs font-medium tabular-nums text-warm-gray-600 dark:text-warm-gray-300">
            {volumePercent}%
          </span>
          <input
            id="app-volume-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value={volumePercent}
            onChange={(event) => setVolume(Number(event.target.value) / 100)}
            aria-label="App volume"
            className="h-24 w-5 cursor-pointer accent-sage-600"
            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
            tabIndex={isOpen ? 0 : -1}
          />
        </div>
      </div>
    </div>
  );
};

export default VolumeControl;
