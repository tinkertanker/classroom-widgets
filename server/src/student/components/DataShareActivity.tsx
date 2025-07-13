import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import './DataShareActivity.css';

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
      <div className="activity-container">
        
        <div className="success">
          Link shared successfully!
        </div>
        
      </div>
    );
  }

  return (
    <div className="activity-container">
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="shareLink">Presentation Link</label>
          <input
            type="url"
            id="shareLink"
            placeholder="https://example.com/presentation"
            value={shareLink}
            onChange={(e) => setShareLink(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={isSubmitting} style={{ marginTop: '1rem' }}>
          {isSubmitting ? (
            <>
              <span className="loading"></span>
              Sharing...
            </>
          ) : (
            'Share Link'
          )}
        </button>
        {error && <div className="error">{error}</div>}
      </form>
      
    </div>
  );
};

export default DataShareActivity;