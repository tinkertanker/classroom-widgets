import React, { useState, useRef, useEffect } from 'react';
import { FaFolder, FaChevronDown, FaPlus } from 'react-icons/fa6';
import { clsx } from 'clsx';
import { useWorkspaceManager } from '../../hooks/useWorkspaceManager';
import { WorkspaceItem } from './WorkspaceItem';
import { hudContainer, dropdownContainer, zIndex, menuItem } from '@shared/utils/styles';

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
          hudContainer.base,
          hudContainer.hover,
          'flex items-center space-x-2 h-10 px-3'
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
          dropdownContainer,
          zIndex.hudDropdown
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
          <div className={menuItem.divider} />

          {/* Create new workspace button */}
          <button
            onClick={handleCreate}
            className={clsx(
              menuItem.base,
              'text-sage-600 dark:text-sage-400'
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
