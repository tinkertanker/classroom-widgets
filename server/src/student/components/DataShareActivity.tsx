import React, { useState } from 'react';
import { Socket } from 'socket.io-client';

interface DataShareActivityProps {
  socket: Socket;
  roomCode: string;
  studentName: string;
}

const DataShareActivity: React.FC<DataShareActivityProps> = ({ 
  socket, 
  roomCode, 
  studentName
}) => {
  const [shareLink, setShareLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!shareLink.trim()) {
      setError('Please enter a link to share');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    socket.emit('dataShare:submit', {
      code: roomCode,
      studentName: studentName || 'Anonymous',
      link: shareLink.trim()
    });

    // Listen for response
    socket.once('dataShare:submitted', (response: { success: boolean; error?: string }) => {
      setIsSubmitting(false);
      
      if (response.success) {
        setIsSuccess(true);
      } else {
        setError(response.error || 'Failed to share link. Please try again.');
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      setIsSubmitting(false);
      setError('Connection timeout. Please try again.');
    }, 10000);
  };

  if (isSuccess) {
    return (
      <div>
        <div className="bg-sage-50 border border-sage-200 rounded-lg p-5 text-center text-sage-700 font-medium my-5">
          Link shared successfully!
        </div>
        
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="shareLink" className="block text-sm font-semibold text-warm-gray-700 mb-2">Presentation Link</label>
          <input
            type="url"
            id="shareLink"
            placeholder="https://example.com/presentation"
            value={shareLink}
            onChange={(e) => setShareLink(e.target.value)}
            required
            className="w-full py-2 px-3 border border-warm-gray-300 rounded-md text-sm bg-white text-warm-gray-800 focus:outline-none focus:border-sage-500 focus:shadow-[0_0_0_2px_rgba(94,139,94,0.2)]"
          />
        </div>
        <button type="submit" disabled={isSubmitting} className="mt-4 w-full bg-terracotta-500 text-white py-1.5 px-3 rounded-md text-sm font-semibold cursor-pointer transition-colors duration-200 hover:bg-terracotta-600 disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? 'Sharing...' : 'Share Link'}
        </button>
        {error && <div className="mt-3 bg-dusty-rose-50 text-dusty-rose-700 p-3 rounded-md text-sm border border-dusty-rose-200">{error}</div>}
      </form>
      
    </div>
  );
};

export default DataShareActivity;