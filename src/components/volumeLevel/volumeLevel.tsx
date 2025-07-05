// Removed Chakra UI imports
import React, { useEffect, useRef, useState } from 'react';

const AudioVolumeMonitor: React.FC = () => {
    const [volume, setVolume] = useState<number>(0);
    const [threshold, setThreshold] = useState<number>(20); // Default threshold
    const [cooldownTime, setCooldownTime] = useState<number>(0); // Cooldown time in seconds
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sound = useRef<HTMLAudioElement | null>(null);
    const isCooldownRef = useRef<boolean>(false); // Use a ref to track cooldown status
    const thresholdRef = useRef<number>(threshold); // Use a ref to track threshold

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

                const intervalId = setInterval(() => {
                    monitorVolume();
                }, 100); // Check volume every 0.5 seconds

                return () => clearInterval(intervalId);
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
    }, []);

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

            setVolume(Math.min(normalizedVolume, 100)); // Cap at 100%

            // Check if the volume exceeds the threshold and cooldown is not active
            if (normalizedVolume > thresholdRef.current && !isCooldownRef.current) {
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
            className="w-full h-full border border-warm-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col bg-soft-white"
        >
            <div className="p-4">
                <h3 className="text-base font-semibold mb-2 text-warm-gray-800">
                    Audio Volume Monitor
                </h3>
                <div className="flex flex-col space-y-4">
                    <div>
                        <p className="text-sm mb-2 text-warm-gray-700">
                            Set Volume Threshold
                        </p>
                        <input
                            type='range'
                            min='0'
                            max='100'
                            value={threshold}
                            onChange={(e) => setThreshold(Number(e.target.value))}
                            aria-label='Volume Threshold'
                            className="w-full"
                        />
                        <p className="mt-2 text-sm text-warm-gray-700">
                            Threshold: {threshold}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-warm-gray-700">Volume Level: {volume.toFixed(2)}</p>
                    </div>
                </div>
            </div>
            <div className="flex-1 p-4">
                <div
                    className="w-full h-5 bg-warm-gray-200 rounded-md relative"
                >
                    <div
                        style={{ width: `${volume}%` }}
                        className={`h-full rounded-md transition-all duration-200 ${volume > threshold ? 'bg-dusty-rose-500' : 'bg-green-500'}`}
                    />
                </div>
                <div className="flex flex-row mt-4 space-x-4 justify-between">
                    <p className="text-sm text-warm-gray-700">Cooldown Timer:</p>
                    {isCooldownRef.current ? (
                        <p className="text-sm text-dusty-rose-500">
                            {cooldownTime} second{cooldownTime !== 1 ? 's' : ''} remaining
                        </p>
                    ) : (
                        <p className="text-sm text-green-500">
                            Bell is ready to play!
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AudioVolumeMonitor;
