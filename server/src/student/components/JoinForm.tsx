import React, { useState, useEffect } from 'react';

interface JoinFormProps {
  onJoin: (code: string, name: string) => Promise<void>;
  defaultName?: string;
  onNameChange?: (name: string) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const JoinForm: React.FC<JoinFormProps> = ({ onJoin, defaultName = '', onNameChange, isDarkMode, onToggleDarkMode }) => {
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
      setError('Please enter a valid 5-character activity code');
      return;
    }

    // Name is now optional, use default if empty
    const finalName = name.trim() || 'Anonymous';

    setIsLoading(true);
    try {
      await onJoin(code, finalName);
      // Clear the code field on success but keep the name
      setCode('');
      // Update parent's name state
      if (onNameChange) {
        onNameChange(finalName);
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
        <div className="header-content">
          <div className="header-text">
            <h1>Join Classroom Activity</h1>
            <p className="subtitle">Enter an activity code to participate</p>
          </div>
          {onToggleDarkMode && (
            <button 
              onClick={onToggleDarkMode}
              className="dark-mode-toggle"
              aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          )}
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="join-form">
        <div className="form-row">
          <div className="form-group name-group">
            <label htmlFor="name">Your Name <span className="optional">(optional)</span></label>
            <input
              type="text"
              id="name"
              className="name-input"
              placeholder="Enter your name"
              value={name}
              onChange={handleNameChange}
              autoComplete="name"
              maxLength={50}
            />
          </div>
          
          <div className="form-group code-group">
            <label htmlFor="code">Activity Code</label>
            <input
              type="text"
              id="code"
              className="code-input"
              maxLength={5}
              pattern="[23456789ACDEFHJKMNPQRTUWXY]{5}"
              placeholder="123AB"
              value={code}
              onChange={handleCodeChange}
              required
              autoComplete="off"
              aria-describedby={error ? "error-message" : undefined}
            />
          </div>
          
          <button 
            type="submit" 
            className="join-button"
            disabled={isLoading || !code}
          >
            {isLoading ? 'Joining...' : 'Join Activity'}
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