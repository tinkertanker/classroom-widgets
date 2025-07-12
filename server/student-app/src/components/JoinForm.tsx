import React, { useState, useEffect } from 'react';

interface JoinFormProps {
  onJoin: (code: string, name: string) => Promise<void>;
}

const JoinForm: React.FC<JoinFormProps> = ({ onJoin }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check for room code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('code');
    if (urlCode && /^\d{4}$/.test(urlCode)) {
      setCode(urlCode);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!/^\d{4}$/.test(code)) {
      setError('Please enter a valid 4-digit code');
      return;
    }

    setIsLoading(true);
    try {
      await onJoin(code, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setCode(value);
  };

  return (
    <div className="container">
      <h1>Join Classroom Activity</h1>
      <p className="subtitle">Enter your room code to participate</p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="code">Room Code</label>
          <input
            type="text"
            id="code"
            className="code-input"
            maxLength={4}
            pattern="[0-9]{4}"
            placeholder="0000"
            value={code}
            onChange={handleCodeChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="name">Your Name (Optional)</label>
          <input
            type="text"
            id="name"
            placeholder="Student"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="loading"></span>
              Checking...
            </>
          ) : (
            'Join Activity'
          )}
        </button>
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
};

export default JoinForm;