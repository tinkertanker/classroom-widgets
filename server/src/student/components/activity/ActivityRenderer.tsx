import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { Socket } from 'socket.io-client';
import type {
  ActivityDefinition,
  ActivityAction,
  ActivityResults,
  StudentAnswers
} from '../../../../../src/shared/types/activity.types';
import { ActivityProvider, useActivity } from './context/ActivityContext';
import { BlockRenderer } from './BlockRenderer';

interface ActivityRendererProps {
  socket: Socket;
  sessionCode: string;
  widgetId?: string;
  initialActivity?: ActivityDefinition;
  initialIsActive?: boolean;
  initialActions?: ActivityAction[];
}

function ActivityContent() {
  const {
    activity,
    isActive,
    actions,
    results,
    getAnswers
  } = useActivity();

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Configure sensors for both mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5
      }
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);

    const { active, over } = event;
    if (over && active.id !== over.id) {
      const { placeItem } = useActivity();
      // Place item in target - this is handled by context
    }
  };

  if (!activity) {
    return (
      <div className="flex items-center justify-center h-full text-warm-gray-500 dark:text-warm-gray-400">
        <p>Loading activity...</p>
      </div>
    );
  }

  const activeItem = activeDragId ? activity.items.find(i => i.id === activeDragId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4">
        {/* Title and instructions */}
        {activity.title && (
          <h3 className="text-lg font-semibold text-warm-gray-800 dark:text-warm-gray-200">
            {activity.title}
          </h3>
        )}

        {activity.instructions && (
          <p className="text-warm-gray-600 dark:text-warm-gray-400 text-sm">
            {activity.instructions}
          </p>
        )}

        {/* Paused overlay */}
        {!isActive && !results && (
          <div className="bg-warm-gray-100 dark:bg-warm-gray-800 rounded-lg p-4 text-center">
            <p className="text-warm-gray-600 dark:text-warm-gray-400">
              Activity is paused. Please wait for your teacher.
            </p>
          </div>
        )}

        {/* Render UI recipe */}
        <div className="space-y-4">
          {activity.uiRecipe.map((block, index) => (
            <BlockRenderer key={block.id || index} block={block} />
          ))}
        </div>

        {/* Results summary */}
        {results && (
          <div className={`
            rounded-lg p-4
            ${results.score === results.total
              ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
              : 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700'
            }
          `}>
            <p className={`font-semibold ${
              results.score === results.total
                ? 'text-green-700 dark:text-green-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}>
              Score: {results.score} / {results.total}
            </p>
          </div>
        )}
      </div>

      {/* Drag overlay for smooth dragging */}
      <DragOverlay>
        {activeItem ? (
          <div className="px-3 py-2 rounded-lg bg-sage-200 dark:bg-sage-800 text-sage-800 dark:text-sage-200 font-medium text-sm shadow-lg">
            {activeItem.content}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ActivityActions({
  socket,
  sessionCode,
  widgetId
}: {
  socket: Socket;
  sessionCode: string;
  widgetId?: string;
}) {
  const { actions, getAnswers, clearAnswers, results, isActive } = useActivity();

  const submitAction = actions.find(a => a.type === 'submit');
  const retryAction = actions.find(a => a.type === 'retry');

  const handleSubmit = useCallback(() => {
    const answers = getAnswers();
    socket.emit('session:activity:submit', {
      sessionCode,
      widgetId,
      answers
    }, (response: any) => {
      if (!response.success) {
        console.error('Failed to submit activity:', response.error);
      }
    });
  }, [socket, sessionCode, widgetId, getAnswers]);

  const handleRetry = useCallback(() => {
    // Emit retry event to server to clear response
    socket.emit('session:activity:retry', {
      sessionCode,
      widgetId
    }, (response: any) => {
      if (response.success) {
        // Clear local answers after server confirms
        clearAnswers();
      } else {
        console.error('Failed to retry activity:', response.error);
      }
    });
  }, [socket, sessionCode, widgetId, clearAnswers]);

  const hasAnswers = () => {
    const answers = getAnswers();
    return answers.placements.length > 0 || Object.keys(answers.textInputs).length > 0;
  };

  if (!isActive && !results) {
    return null;
  }

  return (
    <div className="flex gap-2 mt-4">
      {submitAction && !results && (
        <button
          onClick={handleSubmit}
          disabled={!submitAction.enabled || !hasAnswers()}
          className={`
            flex-1 px-4 py-2 rounded-lg font-medium
            transition-all duration-150
            ${submitAction.enabled && hasAnswers()
              ? 'bg-sage-500 hover:bg-sage-600 text-white'
              : 'bg-warm-gray-300 dark:bg-warm-gray-700 text-warm-gray-500 dark:text-warm-gray-400 cursor-not-allowed'
            }
          `}
        >
          {submitAction.label || 'Submit'}
        </button>
      )}

      {retryAction && retryAction.enabled && results && (
        <button
          onClick={handleRetry}
          className="flex-1 px-4 py-2 rounded-lg font-medium bg-warm-gray-200 dark:bg-warm-gray-700 hover:bg-warm-gray-300 dark:hover:bg-warm-gray-600 text-warm-gray-700 dark:text-warm-gray-300 transition-all duration-150"
        >
          {retryAction.label || 'Try Again'}
        </button>
      )}
    </div>
  );
}

export function ActivityRenderer({
  socket,
  sessionCode,
  widgetId,
  initialActivity,
  initialIsActive = false,
  initialActions = []
}: ActivityRendererProps) {
  const [activity, setActivity] = useState<ActivityDefinition | null>(initialActivity || null);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [actions, setActions] = useState<ActivityAction[]>(initialActions);
  const [results, setResults] = useState<ActivityResults | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState<Record<string, string> | null>(null);

  // Socket event handlers
  useEffect(() => {
    const handleStateUpdate = (data: any) => {
      if (data.widgetId !== widgetId) return;
      setActivity(data.activity);
      setIsActive(data.isActive);
      setActions(data.actions);
    };

    const handleFeedback = (data: any) => {
      if (data.widgetId !== widgetId) return;
      setResults(data.results);
      setActions(data.actions);
    };

    const handleRevealed = (data: any) => {
      if (data.widgetId !== widgetId) return;
      setCorrectAnswers(data.correctAnswers);
    };

    const handleWidgetStateChanged = (data: any) => {
      if (data.widgetId !== widgetId || data.roomType !== 'activity') return;
      setIsActive(data.isActive);

      // When activity becomes active, request fresh state to get updated actions
      if (data.isActive) {
        socket.emit('activity:requestState', { sessionCode, widgetId });
      }
    };

    const handleRetryReady = (data: any) => {
      if (data.widgetId !== widgetId) return;
      // Clear results and update actions to allow re-submission
      setResults(null);
      setActions(data.actions);
    };

    socket.on('activity:stateUpdate', handleStateUpdate);
    socket.on('activity:feedback', handleFeedback);
    socket.on('activity:revealed', handleRevealed);
    socket.on('session:widgetStateChanged', handleWidgetStateChanged);
    socket.on('activity:retryReady', handleRetryReady);

    // Request current state on mount
    socket.emit('activity:requestState', { sessionCode, widgetId });

    return () => {
      socket.off('activity:stateUpdate', handleStateUpdate);
      socket.off('activity:feedback', handleFeedback);
      socket.off('activity:revealed', handleRevealed);
      socket.off('session:widgetStateChanged', handleWidgetStateChanged);
      socket.off('activity:retryReady', handleRetryReady);
    };
  }, [socket, sessionCode, widgetId]);

  return (
    <ActivityProvider
      activity={activity}
      isActive={isActive}
      actions={actions}
      results={results}
      correctAnswers={correctAnswers}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto">
          <ActivityContentWithDnd />
        </div>
        <ActivityActions
          socket={socket}
          sessionCode={sessionCode}
          widgetId={widgetId}
        />
      </div>
    </ActivityProvider>
  );
}

// Wrapper that provides drag context and handles drag events
function ActivityContentWithDnd() {
  const { activity, placeItem } = useActivity();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5
      }
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);

    const { active, over } = event;
    if (over) {
      placeItem(active.id as string, over.id as string);
    }
  };

  const activeItem = activeDragId && activity ? activity.items.find(i => i.id === activeDragId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ActivityContentInner />

      {/* Drag overlay rendered via portal to avoid transform offset issues */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="px-3 py-2 rounded-lg bg-sage-200 dark:bg-sage-800 text-sage-800 dark:text-sage-200 font-medium text-sm shadow-lg pointer-events-none">
              {activeItem.content}
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}

function ActivityContentInner() {
  const { activity, isActive, results } = useActivity();

  if (!activity) {
    return (
      <div className="flex items-center justify-center h-full text-warm-gray-500 dark:text-warm-gray-400">
        <p>Loading activity...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Title and instructions are now shown in the header row of App.tsx */}

      {/* Paused overlay */}
      {!isActive && !results && (
        <div className="bg-warm-gray-100 dark:bg-warm-gray-800 rounded-lg p-4 text-center">
          <p className="text-warm-gray-600 dark:text-warm-gray-400">
            Activity is paused. Please wait for your teacher.
          </p>
        </div>
      )}

      {/* Render UI recipe */}
      <div className="space-y-4">
        {activity.uiRecipe.map((block, index) => (
          <BlockRenderer key={block.id || index} block={block} />
        ))}
      </div>

      {/* Results summary */}
      {results && (
        <div className={`
          rounded-lg p-4
          ${results.score === results.total
            ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
            : 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700'
          }
        `}>
          <p className={`font-semibold ${
            results.score === results.total
              ? 'text-green-700 dark:text-green-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}>
            Score: {results.score} / {results.total}
          </p>
        </div>
      )}
    </div>
  );
}

export default ActivityRenderer;
