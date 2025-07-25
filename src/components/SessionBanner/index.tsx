// SessionBanner - Shows the current session code and student URL

import React from 'react';
import { useServerConnection } from '../../hooks/useWorkspace';
import { FaXmark } from 'react-icons/fa6';

interface SessionBannerProps {
  sessionCode: string;
  onClose: () => void;
}

const SessionBanner: React.FC<SessionBannerProps> = ({ sessionCode, onClose }) => {
  const { url: serverUrl } = useServerConnection();
  const studentUrl = `${serverUrl}/student`;
  
  return (
    <div className="bg-sage-500 text-white px-4 py-2 flex items-center justify-between">
      <div className="flex items-center space-x-6">
        <div>
          <span className="text-sm opacity-90">Visit:</span>{' '}
          <span className="font-medium">{studentUrl}</span>
        </div>
        <div>
          <span className="text-sm opacity-90">Code:</span>{' '}
          <span className="font-bold text-lg">{sessionCode}</span>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-1 hover:bg-sage-600 rounded transition-colors"
        title="Close session banner"
      >
        <FaXmark />
      </button>
    </div>
  );
};

export default SessionBanner;