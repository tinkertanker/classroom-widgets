import React, { useState, useRef, useEffect } from 'react';
import { FaCheck, FaPencil, FaTrash } from 'react-icons/fa6';
import { clsx } from 'clsx';
import { WorkspaceMetadata } from '../../../../store/workspaceStore';

interface WorkspaceItemProps {
  workspace: WorkspaceMetadata;
  isActive: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

export const WorkspaceItem: React.FC<WorkspaceItemProps> = ({
  workspace,
  isActive,
  canDelete,
  onSelect,
  onRename,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(workspace.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(workspace.name);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== workspace.name) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditName(workspace.name);
      setIsEditing(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete workspace "${workspace.name}"? This cannot be undone.`)) {
      onDelete();
    }
  };

  return (
    <div
      className={clsx(
        'group flex items-center px-3 py-2 cursor-pointer transition-colors',
        isActive
          ? 'bg-sage-100 dark:bg-sage-900/30'
          : 'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700'
      )}
      onClick={isEditing ? undefined : onSelect}
    >
      {/* Active indicator */}
      <div className="w-5 flex-shrink-0">
        {isActive && (
          <FaCheck className="w-3 h-3 text-sage-600 dark:text-sage-400" />
        )}
      </div>

      {/* Workspace name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full px-1 py-0.5 text-sm bg-white dark:bg-warm-gray-800 border border-sage-400 dark:border-sage-600 rounded outline-none focus:ring-1 focus:ring-sage-500"
            maxLength={50}
          />
        ) : (
          <span className={clsx(
            'text-sm truncate block',
            isActive
              ? 'text-sage-700 dark:text-sage-300 font-medium'
              : 'text-warm-gray-700 dark:text-warm-gray-300'
          )}>
            {workspace.name}
          </span>
        )}
      </div>

      {/* Widget count badge */}
      {!isEditing && (
        <span className="mx-2 text-xs text-warm-gray-400 dark:text-warm-gray-500">
          {workspace.widgetCount}
        </span>
      )}

      {/* Action buttons (visible on hover) */}
      {!isEditing && (
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleStartEdit}
            className="p-1 rounded hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 transition-colors"
            title="Rename workspace"
          >
            <FaPencil className="w-3 h-3 text-warm-gray-500 dark:text-warm-gray-400" />
          </button>
          {canDelete && (
            <button
              onClick={handleDelete}
              className="p-1 rounded hover:bg-dusty-rose-100 dark:hover:bg-dusty-rose-900/30 transition-colors"
              title="Delete workspace"
            >
              <FaTrash className="w-3 h-3 text-dusty-rose-500 dark:text-dusty-rose-400" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
