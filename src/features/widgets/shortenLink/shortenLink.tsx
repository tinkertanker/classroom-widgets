import React, { useState } from 'react';
import axios from 'axios';
import QRCode from 'react-qr-code';
import { WidgetInput } from '../../../shared/components/WidgetInput';
import { widgetContainer } from '../../../shared/utils/styles';
import { useTemporaryState } from '../../../shared/hooks/useTemporaryState';

// Use environment variables for API configuration
const API_KEY = import.meta.env.VITE_SHORTIO_API_KEY || '';
const BASE_URL = import.meta.env.VITE_SHORTIO_BASE_URL || 'https://api.short.io/links';

interface ShortenLinkProps {
}

const ShortenLink: React.FC<ShortenLinkProps> = () => {
  const [link, setLink] = useState<string>('');
  const [shortenedLink, setShortenedLink] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { value: copied, setTemporaryValue: showCopied, clear: clearCopied } = useTemporaryState(false, 2000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!link.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!API_KEY) {
      setError('Short.io API key not configured. Please set VITE_SHORTIO_API_KEY in your environment.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setShortenedLink('');
    
    try {
      const response = await axios.post(
        BASE_URL,
        {
          originalURL: link,
          domain: "tk.sg"
        },
        {
          headers: {
            authorization: API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data && (response.data.secureShortURL || response.data.shortURL)) {
        setShortenedLink(response.data.secureShortURL || response.data.shortURL);
        setError(null);
      } else {
        setError('Failed to shorten the link. Please try again.');
      }
    } catch (err) {
      console.error('Error shortening the link:', err);
      setError('Unable to shorten link. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shortenedLink);
    showCopied(true);
  };

  const resetForm = () => {
    setLink('');
    setShortenedLink('');
    setError(null);
    clearCopied();
  };

  return (
    <div className={`${widgetContainer} p-4`}>
      {!shortenedLink ? (
        // Input state
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div>
              <h2 className="text-lg font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-4 text-center">
                Shorten Your Link
              </h2>
              <WidgetInput
                type="url"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setError(null);
                }}
                placeholder="https://example.com"
                className="text-sm"
                autoFocus
                disabled={isLoading}
              />
              {error && (
                <p className="text-dusty-rose-500 dark:text-dusty-rose-400 text-xs mt-2">
                  {error}
                </p>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !link.trim()}
            className="w-full px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Shortening...' : 'Shorten Link'}
          </button>
        </form>
      ) : (
        // Result state
        <div className="flex flex-col h-full">
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                Original URL:
              </p>
              <p className="text-xs text-warm-gray-500 dark:text-warm-gray-500 break-all px-2">
                {link}
              </p>
            </div>
            
            <div className="bg-white p-3 rounded-lg shadow-inner">
              <QRCode 
                value={shortenedLink} 
                size={150}
                fgColor="#1f2937"
                bgColor="#ffffff"
              />
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
                Shortened Link:
              </p>
              <div className="flex items-center gap-2 justify-center">
                <a 
                  href={shortenedLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sage-600 dark:text-sage-400 hover:text-sage-700 dark:hover:text-sage-300 text-sm"
                >
                  {shortenedLink}
                </a>
                <button
                  onClick={(_e) => {
                    copyToClipboard();
                  }}
                  className="p-1 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          <button
            onClick={(e) => {
              resetForm();
            }}
            className="w-full px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200"
          >
            Shorten Another Link
          </button>
        </div>
      )}
    </div>
  );
};

export default ShortenLink;
