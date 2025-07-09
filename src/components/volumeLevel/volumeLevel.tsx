// Removed Chakra UI imports
import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { FaBell, FaMicrophone } from 'react-icons/fa6';

interface AudioVolumeMonitorProps {
}

const AudioVolumeMonitor: React.FC<AudioVolumeMonitorProps> = () => {
    const [volume, setVolume] = useState<number>(0);
    const [threshold, setThreshold] = useState<number>(20); // Default threshold
    const [cooldownTime, setCooldownTime] = useState<number>(0); // Cooldown time in seconds
    const [isEnabled, setIsEnabled] = useState<boolean>(true); // Widget enabled state
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sound = useRef<HTMLAudioElement | null>(null);
    const isCooldownRef = useRef<boolean>(false); // Use a ref to track cooldown status
    const thresholdRef = useRef<number>(threshold); // Use a ref to track threshold
    const volumeHistoryRef = useRef<number[]>([]); // Store volume history for smoothing
    const SMOOTHING_SAMPLES = 10; // Number of samples to average

    const COOLDOWN_DURATION = 5; // 5 seconds cooldown

    useEffect(() => {
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

                let intervalId: NodeJS.Timeout | null = null;
                if (isEnabled) {
                    intervalId = setInterval(() => {
                        monitorVolume();
                    }, 100); // Check volume every 0.1 seconds
                }

                return () => {
                    if (intervalId) clearInterval(intervalId);
                };
            } catch (err) {
                console.error('Error accessing the microphone', err);
            }
        };

        setupAudio();

        return () => {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, [isEnabled]);

    // Reset volume when disabled
    useEffect(() => {
        if (!isEnabled) {
            setVolume(0);
            volumeHistoryRef.current = [];
        }
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
            sound.current = new Audio(require('./Ram-Bell-Sound.mp3'));
            sound.current.volume = 0.3;
        }
        sound.current.play();
    };

    return (
        <div
            className="w-full h-full border border-warm-gray-200 dark:border-warm-gray-700 rounded-md shadow-sm flex flex-col bg-soft-white dark:bg-warm-gray-800"
        >
            <div className="flex-1 p-4 flex flex-col items-center justify-center overflow-visible">
                {/* Odometer-style meter */}
                <div className={`relative w-64 h-36 ${!isEnabled ? 'opacity-50' : ''} transition-opacity duration-300`}>
                    <svg viewBox="0 -10 200 120" className="w-full h-full overflow-visible">
                        {/* Background arc */}
                        <path
                            d="M 20 80 A 80 80 0 0 1 180 80"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="20"
                            className="text-warm-gray-200 dark:text-warm-gray-700"
                        />
                        
                        {/* Calculate segment positions */}
                        {(() => {
                            const centerX = 100;
                            const centerY = 80;
                            const radius = 80;
                            
                            // Green segment (0-60 degrees of 180)
                            const greenEndAngle = Math.PI * (180 - 60) / 180;
                            const greenEndX = centerX + radius * Math.cos(greenEndAngle);
                            const greenEndY = centerY - radius * Math.sin(greenEndAngle);
                            
                            // Yellow segment (60-120 degrees of 180)
                            const yellowEndAngle = Math.PI * (180 - 120) / 180;
                            const yellowEndX = centerX + radius * Math.cos(yellowEndAngle);
                            const yellowEndY = centerY - radius * Math.sin(yellowEndAngle);
                            
                            return (
                                <>
                                    {/* Green segment (0-33%) */}
                                    <path
                                        d={`M 20 80 A 80 80 0 0 1 ${greenEndX} ${greenEndY}`}
                                        fill="none"
                                        stroke="#22c55e"
                                        strokeWidth="20"
                                    />
                                    
                                    {/* Yellow segment (33-66%) */}
                                    <path
                                        d={`M ${greenEndX} ${greenEndY} A 80 80 0 0 1 ${yellowEndX} ${yellowEndY}`}
                                        fill="none"
                                        stroke="#eab308"
                                        strokeWidth="20"
                                    />
                                    
                                    {/* Red segment (66-100%) */}
                                    <path
                                        d={`M ${yellowEndX} ${yellowEndY} A 80 80 0 0 1 180 80`}
                                        fill="none"
                                        stroke="#ef4444"
                                        strokeWidth="20"
                                    />
                                </>
                            );
                        })()}
                        
                        
                        {/* Needle pointer - only show when enabled */}
                        {isEnabled && (
                            <g 
                                transform={`rotate(${threshold > 0 ? Math.min((volume / threshold) * 180, 180) - 90 : -90} 100 80)`}
                                style={{ transition: 'transform 0.3s ease-out' }}
                            >
                                {/* Needle shadow */}
                                <line
                                    x1="100"
                                    y1="80"
                                    x2="100"
                                    y2="30"
                                    stroke="rgba(0,0,0,0.2)"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    transform="translate(1, 1)"
                                />
                                {/* Needle */}
                                <line
                                    x1="100"
                                    y1="80"
                                    x2="100"
                                    y2="30"
                                    stroke="#dc2626"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx="100"
                                    cy="80"
                                    r="8"
                                    fill="#1f2937"
                                    className="dark:fill-warm-gray-600"
                                />
                                <circle
                                    cx="100"
                                    cy="80"
                                    r="4"
                                    fill="#dc2626"
                                />
                            </g>
                        )}
                        
                    </svg>
                </div>
                {/* Volume threshold control */}
                <div className="mt-4 w-64">
                    <p className="text-sm mb-2 text-warm-gray-700 dark:text-warm-gray-300 text-center">
                        Sound level threshold
                    </p>
                    <input
                        type='range'
                        min='0'
                        max='100'
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        aria-label='Volume Threshold'
                        className="w-full"
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
