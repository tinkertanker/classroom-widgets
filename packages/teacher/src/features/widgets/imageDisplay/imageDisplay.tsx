import React, { useState, useRef, useEffect } from 'react';
import { widgetContainer } from '@shared/utils/styles';
import { storeImage, loadImage, deleteImage } from '../../../services/imageStorage';

interface ImageDisplayProps {
  widgetId?: string;
  savedState?: { imageKey?: string | null; imageUrl?: string | null };
  onStateChange?: (state: { imageKey: string | null }) => void;
  isActive?: boolean; // Whether this widget is currently focused
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ widgetId, savedState, onStateChange, isActive = false }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageKeyRef = useRef<string | null>(savedState?.imageKey ?? null);

  // Load image from IndexedDB on mount
  useEffect(() => {
    const key = savedState?.imageKey;
    if (key) {
      loadImage(key).then(url => {
        if (url) setImageUrl(url);
      });
    } else if (savedState?.imageUrl) {
      // Migrate legacy base64 imageUrl to IndexedDB
      const newKey = widgetId ? `image-${widgetId}` : `image-${Date.now()}`;
      storeImage(newKey, savedState.imageUrl).then(() => {
        imageKeyRef.current = newKey;
        setImageUrl(savedState.imageUrl!);
        onStateChange?.({ imageKey: newKey });
      });
    }
  }, []);

  // Update image and notify parent
  const updateImage = async (dataUrl: string | null) => {
    if (dataUrl) {
      const key = widgetId ? `image-${widgetId}` : `image-${Date.now()}`;
      await storeImage(key, dataUrl);
      imageKeyRef.current = key;
      setImageUrl(dataUrl);
      onStateChange?.({ imageKey: key });
    } else {
      if (imageKeyRef.current) {
        await deleteImage(imageKeyRef.current);
        imageKeyRef.current = null;
      }
      setImageUrl(null);
      onStateChange?.({ imageKey: null });
    }
  };

  const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_IMAGE_SIZE) {
      setError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please use an image under 3 MB.`);
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      updateImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle click to open file dialog
  const handleClick = () => {
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

  // Handle paste events (only when this widget is active/focused)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only handle paste if this widget is active/focused
      if (!isActive) {
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
  }, [isActive]);

  // Handle double-click to change image
  const handleDoubleClick = () => {
    if (imageUrl) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${widgetContainer} items-center justify-center relative overflow-hidden cursor-pointer transition-all duration-200 ${
        isDragging
          ? 'bg-sage-100 dark:bg-sage-900/30'
          : imageUrl
          ? 'bg-soft-white/90 dark:bg-warm-gray-800/90'
          : 'bg-warm-gray-200/90 dark:bg-warm-gray-700/90'
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
          {error ? (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          ) : (
            <p className="text-sm text-warm-gray-500 dark:text-warm-gray-400">
              Click to browse, drag & drop, or paste
            </p>
          )}
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