// Removed Chakra UI imports
import React, { useState, useCallback, useEffect } from 'react';
// @ts-ignore
import { FaBell, FaMicrophone } from 'react-icons/fa6';
import ramBellSoundFile from './Ram-Bell-Sound.mp3';
import { 
  useAudioStream, 
  useVolumeAnalyzer, 
  useAudioVisualization, 
  useCooldownTimer,
  useAlertSound 
} from './hooks';

interface AudioVolumeMonitorProps {
  savedState?: {
    threshold?: number;
    isEnabled?: boolean;
  };
  onStateChange?: (state: any) => void;
}

const AudioVolumeMonitor: React.FC<AudioVolumeMonitorProps> = ({ savedState, onStateChange }) => {
    const [threshold, setThreshold] = useState<number>(savedState?.threshold ?? 20); // Default threshold
    const [isEnabled, setIsEnabled] = useState<boolean>(savedState?.isEnabled ?? true); // Widget enabled state

    // Sound management
    const { playSound } = useAlertSound({ soundFile: ramBellSoundFile, volume: 0.3 });

    // Cooldown timer
    const { cooldownTime, isInCooldown, startCooldown } = useCooldownTimer({
        duration: 5,
        onCooldownStart: () => {
            playSound();
        }
    });

    // Volume analyzer with threshold detection
    const { 
        volume, 
        normalizedVolume, 
        startMonitoring, 
        setCooldown 
    } = useVolumeAnalyzer({
        isEnabled,
        threshold,
        smoothingSamples: 10,
        updateInterval: 100,
        onThresholdExceeded: () => {
            if (!isInCooldown) {
                startCooldown();
            }
        }
    });

    // Update cooldown state in volume analyzer
    useEffect(() => {
        setCooldown(isInCooldown);
    }, [isInCooldown, setCooldown]);

    // Save state changes
    useEffect(() => {
        onStateChange?.({
            threshold,
            isEnabled
        });
    }, [threshold, isEnabled, onStateChange]);

    // Audio stream management
    const { analyser } = useAudioStream({
        isEnabled,
        onStreamReady: useCallback((_stream: MediaStream, _audioContext: AudioContext, analyser: AnalyserNode) => {
            // Start monitoring when stream is ready
            const cleanup = startMonitoring(analyser);
            // Store cleanup function for later
            return cleanup;
        }, [startMonitoring])
    });

    // Audio visualization
    const { bars, strokeColor, centerY, barSpacing, rgb } = useAudioVisualization({
        isEnabled,
        normalizedVolume,
        barCount: 60,
        width: 300,
        height: 100
    });

    return (
        <div
            className="w-full h-full border border-warm-gray-200 dark:border-warm-gray-700 rounded-md flex flex-col bg-soft-white dark:bg-warm-gray-800"
        >
            <div className="flex-1 p-4 flex flex-col items-center justify-center overflow-visible">
                {/* Oscilloscope-style waveform visualization */}
                <div className={`relative w-64 h-24 ${!isEnabled ? 'opacity-50' : ''} transition-opacity duration-300`}>
                    <svg viewBox="0 0 300 100" className="w-full h-full">
                        {/* Background center line */}
                        <line
                            x1="0"
                            y1={centerY}
                            x2={300}
                            y2={centerY}
                            stroke="currentColor"
                            strokeWidth="1"
                            className="text-warm-gray-200 dark:text-warm-gray-700"
                            opacity="0.5"
                        />
                        
                        {/* Oscilloscope bars */}
                        {bars.map((bar, index) => (
                            <rect
                                key={index}
                                x={bar.x}
                                y={bar.y1}
                                width={barSpacing}
                                height={bar.barHeight || 1}
                                fill={strokeColor}
                                rx="1"
                                style={{
                                    filter: bar.barHeight > 35 ? `drop-shadow(0 0 4px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6))` : 'none',
                                    transition: 'fill 0.1s ease-out'
                                }}
                            />
                        ))}
                    </svg>
                    {/* Volume percentage display - overlapping */}
                    {isEnabled && (
                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-sm text-warm-gray-400 dark:text-warm-gray-500">
                            {Math.round(normalizedVolume * 100)}%
                        </div>
                    )}
                </div>
                {/* Volume threshold control */}
                <div className="mt-3 w-64 flex items-center gap-2">
                    <span className="text-sm text-warm-gray-700 dark:text-warm-gray-300" title="Sound level threshold">
                        Threshold:
                    </span>
                    <input
                        type='range'
                        min='0'
                        max='100'
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        aria-label='Volume Threshold'
                        className="flex-1 clickable"
                    />
                </div>
                <div className="flex flex-row mt-4 items-center justify-between w-64">
                    {/* Bell icon - left aligned */}
                    <div className={`flex items-center space-x-2 ${
                        isInCooldown ? 'opacity-40' : 'opacity-100'
                    } transition-opacity duration-300`}>
                        {React.createElement(FaBell as any, { className: "w-5 h-5 text-warm-gray-600 dark:text-warm-gray-400" })}
                        {isInCooldown && (
                            <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                                {cooldownTime}s
                            </span>
                        )}
                    </div>
                    
                    {/* Microphone and toggle - right aligned */}
                    <div className="flex items-center space-x-3">
                        {React.createElement(FaMicrophone as any, { className: `w-5 h-5 ${
                            isEnabled ? 'text-warm-gray-600 dark:text-warm-gray-400' : 'text-warm-gray-400 dark:text-warm-gray-600'
                        } transition-colors duration-300`})}
                        
                        <button
                            onClick={(_e) => {
                                setIsEnabled(!isEnabled);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none"
                            style={{ backgroundColor: isEnabled ? '#5e8b5e' : '#d6d2cc' }}
                            title={isEnabled ? 'Disable sound monitoring' : 'Enable sound monitoring'}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                                    isEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AudioVolumeMonitor;