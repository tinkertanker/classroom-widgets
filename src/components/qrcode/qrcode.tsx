import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeWidgetProps {
  savedState?: {
    url: string;
    title: string;
  };
  onStateChange?: (state: any) => void;
}

function QRCodeWidget({ savedState, onStateChange }: QRCodeWidgetProps) {
  const [url, setUrl] = useState(savedState?.url || '');
  const [title, setTitle] = useState(savedState?.title || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR code whenever URL changes
  useEffect(() => {
    if (url && canvasRef.current) {
      // Calculate optimal size based on container
      const container = canvasRef.current.parentElement;
      const maxSize = Math.min(container?.clientWidth || 250, container?.clientHeight || 250) - 16; // 16px for padding
      
      QRCode.toCanvas(canvasRef.current, url, {
        width: Math.max(maxSize, 200),
        margin: 1,
        color: {
          dark: '#1f2937',  // warm-gray-800
          light: '#ffffff'
        }
      }, (error) => {
        if (error) console.error('Error generating QR code:', error);
      });
    } else if (canvasRef.current) {
      // Clear canvas if no URL
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [url]);

  // Update parent state when URL or title changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ url, title });
    }
  }, [url, title, onStateChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urlInput = (e.target as HTMLFormElement).url.value;
    if (urlInput) {
      setUrl(urlInput);
      // Set title to URL if title is empty
      if (!title) {
        setTitle(urlInput);
      }
    }
  };

  const handleTitleSave = () => {
    setTitle(tempTitle);
    setIsEditingTitle(false);
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    }
    if (e.key === 'Escape') {
      setTempTitle(title);
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-2">
      {!url ? (
        // Initial state - show input form
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div>
              <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
                Enter URL to generate QR Code
              </label>
              <input
                type="url"
                name="url"
                placeholder="https://example.com"
                className="w-full px-3 py-2 text-sm border border-warm-gray-300 dark:border-warm-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200"
                autoFocus
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200"
          >
            Generate QR Code
          </button>
        </form>
      ) : (
        // QR code display state
        <>
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Editable title */}
            <div className="mb-2 w-full text-center px-1">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onKeyDown={handleTitleKeyPress}
                  onBlur={handleTitleSave}
                  className="text-lg font-medium text-center w-full px-2 py-1 border-b-2 border-sage-500 bg-transparent focus:outline-none text-warm-gray-700 dark:text-warm-gray-300"
                  autoFocus
                />
              ) : (
                <p 
                  className="text-lg font-medium text-warm-gray-700 dark:text-warm-gray-300 cursor-pointer hover:text-sage-600 dark:hover:text-sage-400 inline-block"
                  onClick={() => {
                    setTempTitle(title);
                    setIsEditingTitle(true);
                  }}
                  title="Click to edit"
                >
                  {title || url}
                </p>
              )}
            </div>
            
            {/* QR Code */}
            <div 
              className="bg-white p-2 rounded-lg shadow-inner cursor-pointer flex-1 flex items-center justify-center"
              onDoubleClick={() => {
                setUrl('');
                setTitle('');
              }}
              title="Double-click to change URL"
            >
              <canvas ref={canvasRef} className="max-w-full max-h-full" />
            </div>
            
            {/* URL display */}
            <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-2 text-center break-all max-w-full px-1">
              {url}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default QRCodeWidget;