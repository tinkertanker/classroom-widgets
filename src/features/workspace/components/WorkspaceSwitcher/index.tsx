import React, { useState, useRef, useEffect } from 'react';
import { FaFolder, FaChevronDown, FaPlus } from 'react-icons/fa6';
import { clsx } from 'clsx';
import { useWorkspaceManager } from '../../hooks/useWorkspaceManager';
import { WorkspaceItem } from './WorkspaceItem';

export const WorkspaceSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    currentWorkspace,
    workspaceList,
    canDeleteWorkspace,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace
  } = useWorkspaceManager();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (workspaceId: string) => {
    if (workspaceId !== currentWorkspace?.id) {
      switchWorkspace(workspaceId);
    }
    setIsOpen(false);
  };

  const handleCreate = () => {
    createWorkspace();
    setIsOpen(false);
  };

  const handleDelete = (workspaceId: string) => {
    deleteWorkspace(workspaceId);
  };

  const handleRename = (workspaceId: string, newName: string) => {
    renameWorkspace(workspaceId, newName);
  };

  // Don't render if no workspaces loaded yet
  if (!currentWorkspace) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center space-x-2 h-10 px-3',
          'bg-soft-white/80 dark:bg-warm-gray-800/80',
          'rounded-lg shadow-md backdrop-blur-sm',
          'border border-warm-gray-300/50 dark:border-warm-gray-600/50',
          'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700',
          'transition-colors'
        )}
        title={currentWorkspace.name}
      >
        <FaFolder className="w-4 h-4 text-sage-600 dark:text-sage-400" />
        <span className="text-sm text-warm-gray-700 dark:text-warm-gray-200 truncate max-w-[120px]">
          {currentWorkspace.name}
        </span>
        <FaChevronDown className={clsx(
          'w-3 h-3 text-warm-gray-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className={clsx(
          'absolute top-full left-0 mt-2 w-64',
          'bg-soft-white dark:bg-warm-gray-800',
          'rounded-lg shadow-lg',
          'border border-warm-gray-200 dark:border-warm-gray-700',
          'overflow-hidden',
          'z-50'
        )}>
          {/* Workspace list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {workspaceList.map(workspace => (
              <WorkspaceItem
                key={workspace.id}
                workspace={workspace}
                isActive={workspace.id === currentWorkspace.id}
                canDelete={canDeleteWorkspace}
                onSelect={() => handleSelect(workspace.id)}
                onRename={(newName) => handleRename(workspace.id, newName)}
                onDelete={() => handleDelete(workspace.id)}
              />
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-warm-gray-200 dark:bg-warm-gray-700" />

          {/* Create new workspace button */}
          <button
            onClick={handleCreate}
            className={clsx(
              'w-full flex items-center px-3 py-2',
              'text-sm text-sage-600 dark:text-sage-400',
              'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700',
              'transition-colors'
            )}
          >
            <FaPlus className="w-3 h-3 mr-2" />
            New Workspace
          </button>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
