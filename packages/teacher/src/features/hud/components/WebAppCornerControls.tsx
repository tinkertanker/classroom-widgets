import React, { useEffect, useRef, useState } from 'react';
import { FaDownload, FaArrowDown, FaCircleInfo } from 'react-icons/fa6';
import { clsx } from 'clsx';
import { dropdownContainer, hudContainer, zIndex } from '@shared/utils/styles';
import { desktopPlatforms } from '../../../desktopDownloads';
import { useWorkspaceUiStore } from '../../../store/workspaceUiStore';

const cornerPosition = clsx('fixed bottom-2 max-[1280px]:bottom-28 pointer-events-auto text-warm-gray-800 dark:text-warm-gray-100', zIndex.hud);
const cornerButton = clsx(hudContainer.button, 'gap-2 px-3 text-sm font-medium transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100');

const WebAppCornerControls: React.FC = () => {
  const serverUrl = useWorkspaceUiStore(state => state.serverStatus.url);
  const [isOpen, setIsOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [isOpen]);

  return (
    <>
    <a
      href="/about"
      data-dashboard-chrome="true"
      className={clsx(cornerPosition, cornerButton, 'left-2 opacity-40')}
    >
      <FaCircleInfo aria-hidden="true" />
      About
    </a>
    <div
      ref={controlRef}
      data-dashboard-chrome="true"
      className={clsx(cornerPosition, 'right-2')}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Download desktop apps"
        aria-expanded={isOpen}
        aria-controls="desktop-downloads"
        onClick={() => setIsOpen(open => !open)}
        className={clsx(
          cornerButton,
          isOpen ? 'opacity-100' : 'opacity-40'
        )}
      >
        <FaDownload aria-hidden="true" />
        Download
      </button>
      {isOpen && (
        <section
          id="desktop-downloads"
          tabIndex={-1}
          aria-label="Download desktop apps"
          className={clsx('absolute bottom-full right-0 mb-2 w-72 max-w-[calc(100vw-1rem)] p-3', dropdownContainer, zIndex.hudDropdown)}
        >
          <h2 className="px-2 pt-1 text-base font-semibold">Get the desktop app</h2>
          <p className="px-2 mt-1 mb-3 text-xs text-warm-gray-600 dark:text-warm-gray-400">Keep your widgets above every app.</p>
          {desktopPlatforms.map(platform => (
            <a
              key={platform.id}
              href={`${serverUrl}/api/downloads/${platform.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-sage-100 dark:hover:bg-warm-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage-500"
            >
              <platform.icon className="w-5 h-5 text-sage-700 dark:text-sage-300" aria-hidden="true" />
              <span className="flex-1">
                <span className="block text-sm font-medium">{platform.name}</span>
                <span className="block text-xs text-warm-gray-600 dark:text-warm-gray-400">{platform.format}</span>
              </span>
              <FaArrowDown className="w-3 h-3 text-warm-gray-500" aria-hidden="true" />
            </a>
          ))}
        </section>
      )}
    </div>
    </>
  );
};

export default WebAppCornerControls;
