import React, { useState, useEffect } from 'react';

interface JoinFormProps {
  onJoin: (code: string, name: string) => Promise<void>;
  defaultName?: string;
  onNameChange?: (name: string) => void;
}

const JoinForm: React.FC<JoinFormProps> = ({ onJoin, defaultName = '', onNameChange }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Update local name when defaultName changes
  useEffect(() => {
    setName(defaultName);
  }, [defaultName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!/^[23456789ACDEFHJKMNPQRTUWXY]{5}$/i.test(code)) {
      setError('Please enter a valid 5-character code');
      return;
    }

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      await onJoin(code, name.trim());
      // Clear the code field on success but keep the name
      setCode('');
      // Update parent's name state
      if (onNameChange) {
        onNameChange(name.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow safe characters
    const value = e.target.value.toUpperCase().replace(/[^23456789ACDEFHJKMNPQRTUWXY]/g, '');
    setCode(value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    // Update parent immediately
    if (onNameChange) {
      onNameChange(value);
    }
    // Clear error when user starts typing
    if (error) setError('');
  };

  return (
    <div className="join-form-container">
      <div className="join-form-header">
        <h1>Join Classroom Activity</h1>
        <p className="subtitle">Enter a room code to participate</p>
      </div>
      
      <form onSubmit={handleSubmit} className="join-form">
        <div className="form-row">
          <div className="form-group code-group">
            <label htmlFor="code">Room Code</label>
            <input
              type="text"
              id="code"
              className="code-input"
              maxLength={5}
              pattern="[23456789ACDEFHJKMNPQRTUWXY]{5}"
              placeholder="ABCDE"
              value={code}
              onChange={handleCodeChange}
              required
              autoComplete="off"
              aria-describedby={error ? "error-message" : undefined}
            />
          </div>
          
          <div className="form-group name-group">
            <label htmlFor="name">Your Name</label>
            <input
              type="text"
              id="name"
              className="name-input"
              placeholder="Enter your name"
              value={name}
              onChange={handleNameChange}
              required
              autoComplete="name"
              maxLength={50}
            />
          </div>
          
          <button 
            type="submit" 
            className="join-button"
            disabled={isLoading || !code || !name.trim()}
          >
            {isLoading ? 'Joining...' : 'Join Room'}
          </button>
        </div>
        
        {error && (
          <div id="error-message" className="error-message" role="alert">
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default JoinForm;