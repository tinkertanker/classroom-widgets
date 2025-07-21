import React from 'react';

interface UnderstandingFeedbackSettingsProps {
  roomCode: string;
  onRoomCodeChange: (code: string) => void;
  onGenerateCode: () => void;
  onClose: () => void;
}

const UnderstandingFeedbackSettings: React.FC<UnderstandingFeedbackSettingsProps> = ({
  roomCode,
  onRoomCodeChange,
  onGenerateCode,
  onClose
}) => {
  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-warm-gray-800 dark:text-warm-gray-200 mb-4">
        Understanding Feedback Settings
      </h2>

      <div className="space-y-4">
        {/* Room Code */}
        <div>
          <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">
            Room Code
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2 text-sm border border-warm-gray-300 dark:border-warm-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 dark:bg-warm-gray-800 dark:text-warm-gray-200"
              placeholder="Enter code"
              maxLength={5}
            />
            <button
              onClick={onGenerateCode}
              className="px-3 py-2 text-sm bg-warm-gray-200 hover:bg-warm-gray-300 dark:bg-warm-gray-700 dark:hover:bg-warm-gray-600 text-warm-gray-700 dark:text-warm-gray-300 rounded-md transition-colors duration-200"
            >
              Generate
            </button>
          </div>
          <p className="mt-1 text-xs text-warm-gray-500 dark:text-warm-gray-400">
            Students will use this code to join the feedback session
          </p>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-warm-gray-100 dark:bg-warm-gray-800 rounded-lg">
          <h3 className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
            How it works:
          </h3>
          <ol className="text-sm text-warm-gray-600 dark:text-warm-gray-400 space-y-1 list-decimal list-inside">
            <li>Start a feedback session to generate a room code</li>
            <li>Students visit the participation URL and enter the code</li>
            <li>Students can adjust their understanding level in real-time</li>
            <li>See live feedback displayed as a distribution chart</li>
          </ol>
        </div>

        {/* Student URL */}
        <div>
          <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">
            Student Participation URL:
          </label>
          <div className="p-2 bg-warm-gray-100 dark:bg-warm-gray-800 rounded text-sm font-mono text-warm-gray-700 dark:text-warm-gray-300 break-all">
            {window.location.protocol}//{window.location.hostname}:3001/student
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm bg-sage-500 hover:bg-sage-600 text-white rounded transition-colors duration-200"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default UnderstandingFeedbackSettings;