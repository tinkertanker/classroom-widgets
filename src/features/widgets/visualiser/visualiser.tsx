import React, { useState, useEffect, useRef } from 'react';
import { BaseWidgetProps } from '../../../shared/types/widget.types';

interface VisualiserProps extends BaseWidgetProps {
  savedState?: {
    deviceId?: string;
    isMirrored?: boolean;
  };
}

const Visualiser: React.FC<VisualiserProps> = ({ savedState, onStateChange }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(savedState?.deviceId || '');
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(savedState?.isMirrored ?? true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Get available video devices
  const getVideoDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      
      // If no device selected, use the first one
      if (!selectedDeviceId && videoDevices.length > 0) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error enumerating devices:', err);
    }
  };

  // Start video stream
  const startVideo = async (deviceId?: string) => {
    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      
      setHasPermission(true);
      setError('');
      setIsLoading(false);
      
      // Get devices after permission is granted
      await getVideoDevices();
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setError('Unable to access camera. Please check permissions.');
      setHasPermission(false);
      setIsLoading(false);
    }
  };

  // Initialize webcam on mount
  useEffect(() => {
    startVideo(selectedDeviceId);

    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handle device change
  useEffect(() => {
    if (selectedDeviceId && hasPermission) {
      startVideo(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  // Update parent state when device or mirror setting changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ deviceId: selectedDeviceId, isMirrored });
    }
  }, [selectedDeviceId, isMirrored, onStateChange]);

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setShowDeviceMenu(false);
  };

  const retryPermission = () => {
    setIsLoading(true);
    setError('');
    startVideo(selectedDeviceId);
  };

  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col relative">
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sage-500"></div>
            <p className="mt-2 text-sm text-warm-gray-600 dark:text-warm-gray-400">
              Accessing camera...
            </p>
          </div>
        </div>
      )}

      {error && !isLoading && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto text-warm-gray-400 dark:text-warm-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-warm-gray-600 dark:text-warm-gray-400 mb-4">
              {error}
            </p>
            <button
              onClick={(_e) => {
                retryPermission();
              }}
              className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {hasPermission && !isLoading && (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover rounded-lg"
            style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
          />
          
          {/* Control buttons */}
          <div className="absolute top-2 right-2 flex gap-2">
            {/* Flip/Mirror button */}
            <button
              onClick={() => setIsMirrored(!isMirrored)}
              className="p-2 bg-warm-gray-800/80 hover:bg-warm-gray-800/90 text-white rounded-lg transition-colors duration-200"
              title={isMirrored ? "Show normal view" : "Show mirrored view"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>

            {/* Camera selection button */}
            {devices.length > 1 && (
              <div className="relative">
                <button
                  onClick={(_e) => {
                    setShowDeviceMenu(!showDeviceMenu);
                  }}
                  className="p-2 bg-warm-gray-800/80 hover:bg-warm-gray-800/90 text-white rounded-lg transition-colors duration-200"
                  title="Change camera"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* Device menu */}
                {showDeviceMenu && (
                  <div className="absolute top-12 right-0 bg-white dark:bg-warm-gray-800 border border-warm-gray-200 dark:border-warm-gray-700 rounded-lg shadow-lg py-2 min-w-[200px] z-10">
                    {devices.map(device => (
                      <button
                        key={device.deviceId}
                        onClick={(_e) => {
                          handleDeviceChange(device.deviceId);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 transition-colors duration-150 ${
                          device.deviceId === selectedDeviceId
                            ? 'bg-sage-50 dark:bg-sage-900/20 text-sage-700 dark:text-sage-300'
                            : 'text-warm-gray-700 dark:text-warm-gray-300'
                        }`}
                      >
                        {device.label || `Camera ${devices.indexOf(device) + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Visualiser;