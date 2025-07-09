import React, { useState, useRef, useEffect } from 'react';

interface ImageDisplayProps {
  savedState?: { imageUrl: string | null };
  onStateChange?: (state: { imageUrl: string | null }) => void;
  isDragging?: boolean;
  hasDragged?: boolean;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ savedState, onStateChange, isDragging: _isDragging, hasDragged }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(savedState?.imageUrl || null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update image and notify parent
  const updateImage = (url: string | null) => {
    setImageUrl(url);
    if (onStateChange) {
      onStateChange({ imageUrl: url });
    }
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        updateImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle click to open file dialog
  const handleClick = () => {
    if (hasDragged) return;
    if (!imageUrl) {
      fileInputRef.current?.click();
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only handle paste if this widget is focused or if there's no image yet
      if (!containerRef.current?.contains(document.activeElement) && imageUrl) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleFileSelect(file);
            e.preventDefault();
            break;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [imageUrl]);

  // Handle double-click to change image
  const handleDoubleClick = () => {
    if (hasDragged) return;
    if (imageUrl) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 flex items-center justify-center relative overflow-hidden cursor-pointer transition-all duration-200 ${
        isDragging 
          ? 'bg-sage-100 dark:bg-sage-900/30' 
          : imageUrl 
          ? 'bg-warm-gray-100 dark:bg-warm-gray-800' 
          : 'bg-warm-gray-200 dark:bg-warm-gray-700'
      }`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      tabIndex={0}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Display"
          className="w-full h-full object-contain"
          draggable={false}
        />
      ) : (
        <div className="text-center p-6">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-warm-gray-400 dark:text-warm-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-warm-gray-600 dark:text-warm-gray-300 font-medium mb-2">
            {isDragging ? 'Drop image here' : 'Add an image'}
          </p>
          <p className="text-sm text-warm-gray-500 dark:text-warm-gray-400">
            Click to browse, drag & drop, or paste
          </p>
        </div>
      )}
      
      {imageUrl && (
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 dark:bg-opacity-70 text-white px-2 py-1 rounded text-xs opacity-0 hover:opacity-100 transition-opacity">
          Double-click to change
        </div>
      )}
    </div>
  );
};

export default ImageDisplay;