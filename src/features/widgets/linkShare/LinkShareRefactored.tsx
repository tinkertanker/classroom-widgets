import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { WidgetProvider } from '../../../contexts/WidgetContext';
import { NetworkedWidgetWrapperV2, useNetworkedWidgetContext } from '../shared/NetworkedWidgetWrapperV2';
import { FaLink, FaTrash, FaPlay, FaPause, FaArrowUpRightFromSquare } from 'react-icons/fa6';
import { useWidgetSocket } from '../shared/hooks';
import { useWidget } from '../../../contexts/WidgetContext';

interface Submission {
  id: string;
  studentName: string;
  link: string;
  timestamp: number;
}

// LinkShare-specific context
interface LinkShareContextType {
  submissions: Submission[];
  isActive: boolean;
  toggleActive: () => void;
  deleteSubmission: (id: string) => void;
  clearSubmissions: () => void;
}

const LinkShareContext = createContext<LinkShareContextType | undefined>(undefined);

const useLinkShare = () => {
  const context = useContext(LinkShareContext);
  if (!context) {
    throw new Error('useLinkShare must be used within LinkShareProvider');
  }
  return context;
};

// LinkShare Header Component
function LinkShareHeader() {
  const { isActive, toggleActive } = useLinkShare();
  const { isRoomActive } = useNetworkedWidgetContext();
  
  if (!isRoomActive) return null;
  
  return (
    <button
      onClick={toggleActive}
      className={`p-1.5 rounded transition-colors duration-200 ${
        isActive 
          ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white' 
          : 'bg-sage-500 hover:bg-sage-600 text-white'
      }`}
      title={isActive ? "Pause accepting links" : "Resume accepting links"}
    >
      {isActive ? <FaPause /> : <FaPlay />}
    </button>
  );
}

// Submission Item Component
function SubmissionItem({ submission }: { submission: Submission }) {
  const { deleteSubmission } = useLinkShare();
  
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Invalid URL';
    }
  };
  
  return (
    <div className="bg-white dark:bg-warm-gray-700 rounded-lg p-3 shadow-sm border border-warm-gray-200 dark:border-warm-gray-600">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-warm-gray-800 dark:text-warm-gray-200">
              {submission.studentName}
            </span>
            <span className="text-xs text-warm-gray-500 dark:text-warm-gray-400">
              {formatTimestamp(submission.timestamp)}
            </span>
          </div>
          <a
            href={submission.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <span className="truncate">{getDomain(submission.link)}</span>
            <FaArrowUpRightFromSquare className="flex-shrink-0 w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-1 truncate">
            {submission.link}
          </p>
        </div>
        <button
          onClick={() => deleteSubmission(submission.id)}
          className="p-1.5 text-dusty-rose-600 hover:text-dusty-rose-700 dark:text-dusty-rose-400 dark:hover:text-dusty-rose-300 hover:bg-dusty-rose-100 dark:hover:bg-dusty-rose-900/20 rounded transition-colors flex-shrink-0"
          title="Delete submission"
        >
          <FaTrash className="text-xs" />
        </button>
      </div>
    </div>
  );
}

// LinkShare Display Component
function LinkShareDisplay() {
  const { submissions, isActive, clearSubmissions } = useLinkShare();
  const { session, isRoomActive } = useNetworkedWidgetContext();
  
  return (
    <>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
          {submissions.length} link{submissions.length !== 1 ? 's' : ''} shared
        </span>
        {submissions.length > 0 && (
          <button
            onClick={clearSubmissions}
            className="text-xs text-dusty-rose-600 hover:text-dusty-rose-700 dark:text-dusty-rose-400 dark:hover:text-dusty-rose-300"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col relative">
        {/* Paused overlay */}
        {!isActive && isRoomActive && session.isConnected && (
          <div className="absolute inset-0 bg-white/60 dark:bg-warm-gray-800/60 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-10">
            <div className="text-center bg-white/90 dark:bg-warm-gray-800/90 rounded-lg px-6 py-4 shadow-lg">
              <p className="text-warm-gray-700 dark:text-warm-gray-300 font-medium mb-2">Link sharing is paused</p>
              <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Click play to accept links</p>
            </div>
          </div>
        )}
        
        {submissions.length > 0 ? (
          <div className="space-y-2 overflow-y-auto flex-1">
            {submissions.map((submission) => (
              <SubmissionItem key={submission.id} submission={submission} />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-warm-gray-500 dark:text-warm-gray-400">
            {isActive ? "Waiting for links..." : "Click play to start accepting links"}
          </div>
        )}
      </div>
    </>
  );
}

// Main LinkShare Content with Provider
function LinkShareContent() {
  const { widgetId, savedState, onStateChange } = useWidget();
  const { session, isRoomActive } = useNetworkedWidgetContext();
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isActive, setIsActive] = useState(false);

  // Load saved state
  useEffect(() => {
    if (savedState) {
      setSubmissions(savedState.submissions || []);
      setIsActive(savedState.isActive !== undefined ? savedState.isActive : false);
    }
  }, [savedState]);

  // Socket event handlers
  const socketEvents = useMemo(() => ({
    'newSubmission': (data: { submission: Submission }) => {
      setSubmissions(prev => [...prev, data.submission]);
    },
    'submissionDeleted': (data: { submissionId: string }) => {
      setSubmissions(prev => prev.filter(s => s.id !== data.submissionId));
    },
    'submissionsCleared': () => {
      setSubmissions([]);
    },
    'dataUpdate': (data: { submissions: Submission[]; isActive: boolean }) => {
      setSubmissions(data.submissions || []);
      setIsActive(data.isActive || false);
    },
    'stateChanged': (data: { isActive: boolean }) => {
      setIsActive(data.isActive);
    }
  }), []);

  // Use the socket hook
  const { emitWidgetEvent, toggleActive: toggleSocketActive } = useWidgetSocket({
    socket: session.socket,
    sessionCode: session.sessionCode,
    roomType: 'linkShare',
    widgetId,
    isActive,
    isRoomActive,
    events: socketEvents,
    startEvent: 'session:linkShare:start',
    stopEvent: 'session:linkShare:stop'
  });

  const toggleActive = useCallback(() => {
    toggleSocketActive(!isActive);
  }, [isActive, toggleSocketActive]);

  const deleteSubmission = useCallback((id: string) => {
    setSubmissions(prev => prev.filter(s => s.id !== id));
    emitWidgetEvent('delete', { submissionId: id });
  }, [emitWidgetEvent]);

  const clearSubmissions = useCallback(() => {
    setSubmissions([]);
    emitWidgetEvent('clear', {});
  }, [emitWidgetEvent]);

  // Persist state changes
  useEffect(() => {
    onStateChange?.({
      submissions,
      isActive
    });
  }, [onStateChange, submissions, isActive]);

  return (
    <LinkShareContext.Provider value={{
      submissions,
      isActive,
      toggleActive,
      deleteSubmission,
      clearSubmissions
    }}>
      <LinkShareDisplay />
    </LinkShareContext.Provider>
  );
}

// Main LinkShare Component
interface LinkShareProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

function LinkShare({ widgetId, savedState, onStateChange }: LinkShareProps) {
  return (
    <WidgetProvider widgetId={widgetId} savedState={savedState} onStateChange={onStateChange}>
      <NetworkedWidgetWrapperV2
        roomType="linkShare"
        title="Link Sharing"
        description="Collect links and resources from students"
        icon={FaLink}
        onRoomClosed={() => {
          // State cleanup handled by wrapper
        }}
        headerChildren={<LinkShareHeader />}
      >
        <LinkShareContent />
      </NetworkedWidgetWrapperV2>
    </WidgetProvider>
  );
}

export default LinkShare;