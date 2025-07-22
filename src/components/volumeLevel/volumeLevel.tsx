// Removed Chakra UI imports
import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { FaBell, FaMicrophone } from 'react-icons/fa6';
import ramBellSoundFile from './Ram-Bell-Sound.mp3';

interface AudioVolumeMonitorProps {
}

const AudioVolumeMonitor: React.FC<AudioVolumeMonitorProps> = () => {
    const [volume, setVolume] = useState<number>(0);
    const [threshold, setThreshold] = useState<number>(20); // Default threshold
    const [cooldownTime, setCooldownTime] = useState<number>(0); // Cooldown time in seconds
    const [isEnabled, setIsEnabled] = useState<boolean>(true); // Widget enabled state
    const [animationTime, setAnimationTime] = useState<number>(0); // For wave animation
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sound = useRef<HTMLAudioElement | null>(null);
    const isCooldownRef = useRef<boolean>(false); // Use a ref to track cooldown status
    const thresholdRef = useRef<number>(threshold); // Use a ref to track threshold
    const volumeHistoryRef = useRef<number[]>([]); // Store volume history for smoothing
    const animationFrameRef = useRef<number | null>(null);
    const SMOOTHING_SAMPLES = 10; // Number of samples to average

    const COOLDOWN_DURATION = 5; // 5 seconds cooldown

    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        
        if (!isEnabled) {
            // Clean up when disabled
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                mediaStreamRef.current = null;
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            analyserRef.current = null;
            dataArrayRef.current = null;
            return;
        }

        const setupAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioContextRef.current = new AudioContext();
                const source = audioContextRef.current.createMediaStreamSource(stream);
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 256;

                const bufferLength = analyserRef.current.frequencyBinCount;
                dataArrayRef.current = new Uint8Array(bufferLength);

                source.connect(analyserRef.current);

                mediaStreamRef.current = stream;

                intervalId = setInterval(() => {
                    monitorVolume();
                }, 100); // Check volume every 0.1 seconds
            } catch (err) {
                console.error('Error accessing the microphone', err);
            }
        };

        setupAudio();

        return () => {
            if (intervalId) clearInterval(intervalId);
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                mediaStreamRef.current = null;
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            analyserRef.current = null;
            dataArrayRef.current = null;
        };
    }, [isEnabled]);

    // Reset volume when disabled
    useEffect(() => {
        if (!isEnabled) {
            setVolume(0);
            volumeHistoryRef.current = [];
        }
    }, [isEnabled]);

    // Animation loop for the wave
    useEffect(() => {
        const animate = () => {
            setAnimationTime(prev => prev + 0.02);
            animationFrameRef.current = requestAnimationFrame(animate);
        };
        
        if (isEnabled) {
            animationFrameRef.current = requestAnimationFrame(animate);
        }
        
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isEnabled]);

    useEffect(() => {
        thresholdRef.current = threshold; // Update the threshold ref whenever the threshold state changes
    }, [threshold]);

    const startCooldown = () => {
        isCooldownRef.current = true;
        setCooldownTime(COOLDOWN_DURATION);

        const intervalId = setInterval(() => {
            setCooldownTime(prevTime => {
                if (prevTime <= 1) {
                    clearInterval(intervalId);
                    isCooldownRef.current = false;
                    return 0;
                }
                return prevTime - 1;
            });
        }, 1000);
    };

    const monitorVolume = () => {
        if (analyserRef.current && dataArrayRef.current) {
            analyserRef.current.getByteTimeDomainData(dataArrayRef.current);

            let sum = 0;
            for (let i = 0; i < dataArrayRef.current.length; i++) {
                const value = dataArrayRef.current[i] - 128; // Centering the data around 0
                sum += value * value; // Squaring by multiplication for efficiency
            }
            const rms = Math.sqrt(sum / dataArrayRef.current.length);
            const normalizedVolume = (rms / 128) * 100; // Normalize the volume to a percentage

            // Add to volume history
            volumeHistoryRef.current.push(normalizedVolume);
            
            // Keep only the last SMOOTHING_SAMPLES samples
            if (volumeHistoryRef.current.length > SMOOTHING_SAMPLES) {
                volumeHistoryRef.current.shift();
            }
            
            // Calculate moving average
            const averageVolume = volumeHistoryRef.current.reduce((a, b) => a + b, 0) / volumeHistoryRef.current.length;
            
            setVolume(Math.min(averageVolume, 100)); // Cap at 100%

            // Check if the average volume exceeds the threshold and cooldown is not active
            if (isEnabled && averageVolume > thresholdRef.current && !isCooldownRef.current) {
                playAlertSound();
                startCooldown();
            }
        }
    };

    const playAlertSound = () => {
        if (!sound.current) {
            sound.current = new Audio(ramBellSoundFile);
            sound.current.volume = 0.3;
        }
        sound.current.play();
    };

    return (
        <div
            className="w-full h-full border border-warm-gray-200 dark:border-warm-gray-700 rounded-md shadow-sm flex flex-col bg-soft-white dark:bg-warm-gray-800"
        >
            <div className="flex-1 p-4 flex flex-col items-center justify-center overflow-visible">
                {/* Oscilloscope-style waveform visualization */}
                <div className={`relative w-64 h-24 ${!isEnabled ? 'opacity-50' : ''} transition-opacity duration-300`}>
                    <svg viewBox="0 0 300 100" className="w-full h-full">
                        {/* Generate oscilloscope waveform */}
                        {(() => {
                            const width = 300;
                            const height = 100;
                            const centerY = height / 2;
                            
                            // Calculate wave properties based on volume
                            const normalizedVolume = threshold > 0 ? Math.min(volume / threshold, 1) : 0;
                            const amplitude = normalizedVolume * 40; // Max amplitude
                            const barCount = 60; // Number of vertical bars
                            const barWidth = width / barCount;
                            const barSpacing = barWidth * 0.8; // 80% bar, 20% gap
                            
                            // Generate bars
                            const bars = [];
                            
                            for (let i = 0; i < barCount; i++) {
                                const x = i * barWidth + (barWidth - barSpacing) / 2;
                                
                                // Create oscillating pattern with multiple frequencies
                                const phase = (i / barCount) * Math.PI * 4 + animationTime;
                                const mainOscillation = Math.sin(phase) * amplitude;
                                const highFreq = Math.sin(phase * 3.7) * amplitude * 0.3;
                                const lowFreq = Math.sin(phase * 0.5) * amplitude * 0.2;
                                
                                // Add some randomness for realistic audio look
                                const noise = (Math.random() - 0.5) * amplitude * 0.2 * normalizedVolume;
                                
                                // Combine all components
                                const barHeight = Math.abs(mainOscillation + highFreq + lowFreq + noise);
                                
                                // Create symmetrical bars (up and down from center)
                                const y1 = centerY - barHeight / 2;
                                const y2 = centerY + barHeight / 2;
                                
                                bars.push({ x, y1, y2, barHeight });
                            }
                            
                            // Determine color based on volume percentage
                            const volumePercent = normalizedVolume * 100;
                            let baseColor = { r: 34, g: 197, b: 94 }; // Green base
                            
                            if (volumePercent > 70) {
                                baseColor = { r: 239, g: 68, b: 68 }; // Red
                            } else if (volumePercent > 50) {
                                baseColor = { r: 251, g: 146, b: 60 }; // Orange
                            } else if (volumePercent > 20) {
                                baseColor = { r: 234, g: 179, b: 8 }; // Yellow
                            }
                            
                            // Darken the base color and brighten based on volume
                            const brightness = 0.3 + (normalizedVolume * 0.7); // 30% to 100% brightness
                            const r = Math.round(baseColor.r * brightness);
                            const g = Math.round(baseColor.g * brightness);
                            const b = Math.round(baseColor.b * brightness);
                            
                            const strokeColor = `rgb(${r}, ${g}, ${b})`;
                            
                            return (
                                <>
                                    {/* Background center line */}
                                    <line
                                        x1="0"
                                        y1={centerY}
                                        x2={width}
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
                                                filter: bar.barHeight > 35 ? `drop-shadow(0 0 4px rgba(${r}, ${g}, ${b}, 0.6))` : 'none',
                                                transition: 'fill 0.1s ease-out'
                                            }}
                                        />
                                    ))}
                                    
                                </>
                            );
                        })()}
                    </svg>
                    {/* Volume percentage display - overlapping */}
                    {isEnabled && (
                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-sm text-warm-gray-400 dark:text-warm-gray-500">
                            {Math.round((threshold > 0 ? Math.min(volume / threshold, 1) : 0) * 100)}%
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
                        className="flex-1"
                    />
                </div>
                <div className="flex flex-row mt-4 items-center justify-between w-64">
                    {/* Bell icon - left aligned */}
                    <div className={`flex items-center space-x-2 ${
                        isCooldownRef.current ? 'opacity-40' : 'opacity-100'
                    } transition-opacity duration-300`}>
                        {React.createElement(FaBell as any, { className: "w-5 h-5 text-warm-gray-600 dark:text-warm-gray-400" })}
                        {isCooldownRef.current && (
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
