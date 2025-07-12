import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import './DataShareActivity.css';

interface DataShareActivityProps {
  socket: Socket;
  roomCode: string;
  studentName: string;
  onChangeRoom: () => void;
}

const DataShareActivity: React.FC<DataShareActivityProps> = ({ 
  socket, 
  roomCode, 
  studentName: initialName,
  onChangeRoom 
}) => {
  const [studentName, setStudentName] = useState(initialName);
  const [shareLink, setShareLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentName.trim() || !shareLink.trim()) {
      setError('Please fill in all fields');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    socket.emit('dataShare:submit', {
      code: roomCode,
      studentName: studentName.trim(),
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
        <div className="activity-header">
          <div className="room-code">Room: <span>{roomCode}</span></div>
          <div className="activity-type data-share">Share Link</div>
        </div>
        
        <div className="success">
          Link shared successfully!
        </div>
        
        <button className="change-room" onClick={onChangeRoom}>
          Share Another Link
        </button>
      </div>
    );
  }

  return (
    <div className="activity-container">
      <div className="activity-header">
        <div className="room-code">Room: <span>{roomCode}</span></div>
        <div className="activity-type data-share">Share Link</div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="studentName">Your Name</label>
          <input
            type="text"
            id="studentName"
            placeholder="Enter your name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            required
          />
        </div>
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
        <button type="submit" disabled={isSubmitting}>
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
      
      <button className="change-room" onClick={onChangeRoom}>
        Change Room
      </button>
    </div>
  );
};

export default DataShareActivity;