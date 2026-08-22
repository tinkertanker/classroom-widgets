import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WidgetInput } from '@shared/components/WidgetInput';
import { widgetContainer } from '@shared/utils/styles';
import { useWidgetState } from '@shared/hooks/useWidgetState';

interface QRCodeWidgetProps {
  savedState?: {
    url: string;
    title: string;
  };
  onStateChange?: (state: { url: string; title: string }) => void;
}

function QRCodeWidget({ savedState, onStateChange }: QRCodeWidgetProps) {
  const { state, updateState } = useWidgetState<{ url: string; title: string }>({
    initialState: { url: '', title: '' },
    savedState,
    onStateChange
  });
  const { url, title } = state;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const pendingTitleFallbackRef = useRef('');
  const resizeTimeoutRef = useRef<number | null>(null);

  const renderQRCode = useCallback(() => {
    const canvas = canvasRef.current;
    if (url && canvas) {
      const container = qrContainerRef.current;
      const availableSize = Math.min(container?.clientWidth || 250, container?.clientHeight || 250) - 16;
      const targetWidth = Math.max(120, Math.floor(availableSize));

      void import('qrcode').then(({ default: QRCode }) => {
        if (canvasRef.current !== canvas) return;
        QRCode.toCanvas(canvas, url, {
          width: targetWidth,
          margin: 1,
          color: {
            dark: '#1f2937',  // warm-gray-800
            light: '#ffffff'
          }
        }, (error) => {
          if (error) console.error('Error generating QR code:', error);
        });
      });
    } else if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [url]);

  // Regenerate at the available pixel size whenever the panel is resized.
  useEffect(() => {
    renderQRCode();
    const container = qrContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (resizeTimeoutRef.current !== null) window.clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = window.setTimeout(renderQRCode, 150);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (resizeTimeoutRef.current !== null) window.clearTimeout(resizeTimeoutRef.current);
    };
  }, [renderQRCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urlInput = (e.target as HTMLFormElement).url.value;
    if (urlInput) {
      pendingTitleFallbackRef.current = title || urlInput;
      updateState({ url: urlInput });
      setTempTitle('');
      setIsEditingTitle(true);
    }
  };

  const handleTitleSave = () => {
    const trimmedTitle = tempTitle.trim();
    const nextTitle = trimmedTitle || pendingTitleFallbackRef.current || url;
    updateState({ title: nextTitle });
    setIsEditingTitle(false);
    pendingTitleFallbackRef.current = '';
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    }
    if (e.key === 'Escape') {
      setTempTitle(title);
      setIsEditingTitle(false);
      pendingTitleFallbackRef.current = '';
    }
  };

  return (
    <div className={`${widgetContainer} p-2`}>
      {!url ? (
        // Initial state - show input form
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div>
              <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
                Enter URL to generate QR Code
              </label>
              <WidgetInput
                type="url"
                name="url"
                placeholder="https://example.com"
                className="text-sm"
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
                  placeholder="Title"
                  autoFocus
                />
              ) : (
                <p 
                  className="text-lg font-medium text-warm-gray-700 dark:text-warm-gray-300 cursor-pointer hover:text-sage-600 dark:hover:text-sage-400 inline-block"
                  onClick={(_e) => {
                    pendingTitleFallbackRef.current = title || url;
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
              ref={qrContainerRef}
              className="bg-white p-2 rounded-lg shadow-inner cursor-pointer flex-1 flex items-center justify-center"
              onDoubleClick={(_e) => {
                pendingTitleFallbackRef.current = '';
                updateState({ url: '', title: '' });
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
