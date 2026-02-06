import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaChartColumn } from 'react-icons/fa6';
import { useModal } from '../../../contexts/ModalContext';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { useNetworkedWidgetState } from '../../session/hooks/useNetworkedWidgetState';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { widgetWrapper, widgetContainer } from '../../../shared/utils/styles';
import { NetworkedWidgetControlBar, NetworkedWidgetOverlays, NetworkedWidgetStats } from '../shared/components';
import { useSocketEvents } from '../../session/hooks/useSocketEvents';
import { getPollColor } from '../../../shared/constants/pollColors';
import PollSettings from './PollSettings';
import { getRandomPollQuestion } from './pollQuestions';
import { useWidget } from '../../../shared/hooks/useWidget';
import { debug } from '../../../shared/utils/debug';
import { withWidgetProvider, WidgetProps } from '../shared/withWidgetProvider';
import { getEmptyStateButtonText, getEmptyStateDisabled } from '../shared/utils/networkedWidgetHelpers';

interface PollData {
  question: string;
  options: string[];
  isActive?: boolean;
}

interface PollResults {
  votes: { [key: number]: number };
  totalVotes: number;
  participantCount: number;
}

function Poll({ widgetId, savedState, onStateChange }: WidgetProps) {
  // State
  const [pollData, setPollData] = useState<PollData>(() => {
    if (savedState?.pollData) {
      return savedState.pollData;
    }
    // Get a random question for new widgets
    const randomQuestion = getRandomPollQuestion();
    return {
      question: randomQuestion.question,
      options: randomQuestion.options
    };
  });

  const [results, setResults] = useState<PollResults>(() => savedState?.results || {
    votes: {},
    totalVotes: 0,
    participantCount: 0
  });

  const [hasAutoResized, setHasAutoResized] = useState(false);

  // Hooks
  const { showModal, hideModal } = useModal();
  const { widget, resize } = useWidget(widgetId || '');

  // Networked widget hook
  const {
    hasRoom,
    isStarting,
    error,
    handleStart,
    session,
    recoveryData
  } = useNetworkedWidget({
    widgetId,
    roomType: 'poll',
    savedState,
    onStateChange
  });

  // Active state management
  const { isActive: isWidgetActive, toggleActive, setIsActive: setIsWidgetActive } = useNetworkedWidgetState({
    widgetId,
    roomType: 'poll',
    hasRoom,
    recoveryData
  });

  // Socket event handlers (widget-specific only, state change handled by useNetworkedWidgetState)
  const socketEvents = useMemo(() => ({
    'poll:stateUpdate': (data: any) => {
      debug('[Poll] Received poll:stateUpdate:', data, 'for widget:', widgetId);
      if (data.widgetId === widgetId) {
        debug('[Poll] Processing stateUpdate for our widget');
        if (data.pollData) {
          setPollData(data.pollData);
        }
        if (data.results) {
          setResults({
            votes: data.results.votes || {},
            totalVotes: data.results.totalVotes || 0,
            participantCount: data.results.participantCount || 0
          });
        }
      }
    },
    'poll:voteUpdate': (data: any) => {
      debug('[Poll] Received poll:voteUpdate:', data, 'for widget:', widgetId);
      if (data.widgetId === widgetId) {
        debug('[Poll] Updating vote results');
        setResults(prevResults => ({
          ...prevResults,
          votes: data.votes,
          totalVotes: data.totalVotes,
        }));
      }
    }
  }), [widgetId]);

  // Use socket events hook for automatic event management
  const { emit } = useSocketEvents({
    events: socketEvents,
    isActive: hasRoom
  });

  // Reset votes
  const reset = useCallback(() => {
    if (!widgetId || !hasRoom) return;
    emit('session:reset', {
      sessionCode: session.sessionCode!,
      widgetId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);

  // Actions
  const updatePoll = useCallback((data: Partial<PollData>) => {
    const newPollData = { ...pollData, ...data };
    setPollData(newPollData);

    if (hasRoom) {
      emit('session:poll:update', {
        sessionCode: session.sessionCode!,
        widgetId: widgetId!,
        pollData: newPollData as any
      });
    }
  }, [pollData, hasRoom, emit, session.sessionCode, widgetId]);

  const handleToggleActive = useCallback(() => {
    debug('[Poll] handleToggleActive called, current state:', isWidgetActive, 'hasRoom:', hasRoom);

    if (!hasRoom) {
      debug('[Poll] Cannot toggle - no room exists');
      return;
    }

    if (!pollData.question || pollData.options.filter(o => o).length < 2) {
      debug('[Poll] Cannot toggle - invalid question or options');
      return;
    }

    debug('[Poll] Toggling active state');
    toggleActive();

    // Always send the poll data when toggling state
    debug('[Poll] Sending poll data with state change');
    emit('session:poll:update', {
      sessionCode: session.sessionCode!,
      widgetId: widgetId!,
      pollData: pollData as any
    });
  }, [pollData, isWidgetActive, hasRoom, toggleActive, emit, session.sessionCode, widgetId]);

  const openSettings = useCallback(() => {
    showModal({
      title: 'Poll Settings',
      content: <PollSettings
        initialData={{
          question: pollData.question,
          options: pollData.options
        }}
        onSave={(data) => {
          updatePoll(data);
          hideModal();

          // Auto-resize if number of options changed
          if (data.options.length !== pollData.options.length && widget && resize) {
            const baseHeight = 200;
            const optionHeight = 60;
            const maxOptions = 6;
            const visibleOptions = Math.min(data.options.length, maxOptions);
            const calculatedHeight = baseHeight + (visibleOptions * optionHeight);

            debug(`[Poll] Auto-resizing after settings change to height: ${calculatedHeight} for ${data.options.length} options`);
            resize({ width: widget.size.width, height: calculatedHeight });
          }
        }}
        onClose={hideModal}
      />,
      onClose: hideModal
    });
  }, [showModal, hideModal, updatePoll, pollData]);

  const resetVotes = useCallback(() => {
    if (!hasRoom) return;

    debug('[Poll] Resetting votes');
    reset();

    // Clear local results immediately for responsive UI
    setResults({
      votes: {},
      totalVotes: 0,
      participantCount: 0
    });
  }, [hasRoom, reset]);

  // Auto-resize only on initial widget creation
  useEffect(() => {
    if (!widget || !resize || !widgetId || hasAutoResized) return;

    // Only auto-resize once when the widget is first created (not loaded from saved state)
    if (!savedState && widget.size) {
      const baseHeight = 200;
      const optionHeight = 60;
      const maxOptions = 6;

      const visibleOptions = Math.min(pollData.options.length, maxOptions);
      const calculatedHeight = baseHeight + (visibleOptions * optionHeight);

      debug(`[Poll] Auto-resizing new widget to height: ${calculatedHeight} for ${pollData.options.length} options`);
      resize({ width: widget.size.width, height: calculatedHeight });
      setHasAutoResized(true);
    }
  }, [widget, resize, widgetId, savedState, hasAutoResized, pollData.options.length]);

  // Save state
  useEffect(() => {
    onStateChange?.({
      pollData,
      results
    });
  }, [onStateChange, pollData, results]);

  // Handle recovery data - restore poll data after page refresh
  useEffect(() => {
    if (recoveryData && recoveryData.roomData) {
      debug('[Poll] Recovery data available:', recoveryData);

      // Only apply recovered poll data if it has meaningful content
      if (recoveryData.roomData.pollData &&
          recoveryData.roomData.pollData.question &&
          recoveryData.roomData.pollData.options &&
          recoveryData.roomData.pollData.options.length > 0) {
        debug('[Poll] Applying recovered poll data');
        setPollData(recoveryData.roomData.pollData);
      } else {
        debug('[Poll] Recovery data has empty poll data, keeping random question');
      }

      // Apply recovered results if available
      if (recoveryData.roomData.results) {
        setResults(recoveryData.roomData.results);
      }
    }
  }, [recoveryData]);

  // Handle room establishment - send data for new rooms only
  useEffect(() => {
    if (hasRoom && session.socket && session.sessionCode) {
      const timer = setTimeout(() => {
        // For new rooms (no recovery data), send our local data if we have any
        if (!recoveryData && pollData.question && pollData.options.length > 0) {
          debug('[Poll] New room detected, sending initial poll data');
          emit('session:poll:update', {
            sessionCode: session.sessionCode!,
            widgetId: widgetId!,
            pollData: pollData as any
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasRoom]); // Only trigger when hasRoom changes

  // Empty state - show when no room exists
  if (!hasRoom) {
    return (
      <NetworkedWidgetEmpty
        icon={FaChartColumn}
        title="Poll"
        description="Create interactive polls for your students"
        buttonText={getEmptyStateButtonText({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected,
          defaultText: "Start Poll"
        })}
        onStart={handleStart}
        disabled={getEmptyStateDisabled({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected
        })}
        error={error || undefined}
      />
    );
  }

  // Active state
  return (
    <div className={widgetWrapper}>
      <div className={`${widgetContainer} relative`}>
        {/* Statistics */}
        <NetworkedWidgetStats label="Poll">
          {results.totalVotes} vote{results.totalVotes !== 1 ? 's' : ''}
        </NetworkedWidgetStats>

        {/* Poll content */}
        <div className="flex-1 flex flex-col relative p-4 pt-8 overflow-y-auto">
          {/* Overlays */}
          <NetworkedWidgetOverlays
            isActive={isWidgetActive}
            isConnected={session.isConnected}
            isRecovering={session.isRecovering}
            pausedMessage="Poll is paused"
          />

          {pollData.question ? (
            <div className="mt-4 flex flex-col h-full">
              <h3 className="text-lg font-medium text-warm-gray-800 dark:text-warm-gray-200 mb-4">
                {pollData.question}
              </h3>

              <div className={`space-y-3 ${pollData.options.length > 6 ? 'overflow-y-auto pr-2 max-h-[400px]' : ''} flex-1`}>
                {pollData.options.map((option, index) => {
                  const color = getPollColor(index);
                  return (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-warm-gray-700 dark:text-warm-gray-300">{option}</span>
                        <span className="text-warm-gray-500 dark:text-warm-gray-400">
                          {results.votes[index] || 0} votes
                        </span>
                      </div>
                      <div className="h-6 bg-warm-gray-200 dark:bg-warm-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color.progress} ${color.progressDark} transition-all duration-500`}
                          style={{
                            width: `${results.totalVotes > 0 ? ((results.votes[index] || 0) / results.totalVotes) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-warm-gray-500 dark:text-warm-gray-400">
              Click settings to create your poll
            </div>
          )}
        </div>
      </div>

      {/* Control bar */}
      <NetworkedWidgetControlBar
        isActive={isWidgetActive}
        isConnected={session.isConnected}
        onToggleActive={handleToggleActive}
        onSettings={openSettings}
        onClear={resetVotes}
        clearCount={results.totalVotes}
        clearLabel="Reset votes"
        activeLabel="Pause poll"
        inactiveLabel="Start poll"
        disabled={!session.isConnected || !pollData.question || pollData.options.every(opt => !opt)}
        clearVariant="reset"
      />
    </div>
  );
}

export default withWidgetProvider(Poll, 'Poll');
