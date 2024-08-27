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
                monitorVolume();
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
                sum += (dataArrayRef.current[i] - 128) ** 2;
            }
            const rms = Math.sqrt(sum / dataArrayRef.current.length);
            setVolume(rms);

            // Check if the volume exceeds the threshold and cooldown is not active
            if (rms > thresholdRef.current && !isCooldownRef.current) {
                playAlertSound();
                startCooldown();
            }

            requestAnimationFrame(monitorVolume);
        }
    };

    const playAlertSound = () => {
        if (!sound.current) {
            sound.current = new Audio(require("./discord-ping.mp3"));
            sound.current.volume = 0.3;
        }
        sound.current.play();
    };

    return (
        <div>
            <div style={{ marginBottom: '10px' }}>
                Set Volume Threshold:
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                />
            </div>
            <div style={{ marginBottom: '10px' }}>Volume Level: {volume.toFixed(2)}</div>
            <div
                style={{
                    width: '300px',
                    height: '20px',
                    background: 'lightgray',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        width: `${volume * 3}px`,
                        height: '100%',
                        background: volume > threshold ? 'red' : 'green',
                    }}
                ></div>
            </div>

            {/* Cooldown Timer Display */}
            <div style={{ marginTop: '20px' }}>
                {isCooldownRef.current ? (
                    <div>
                        Cooldown: {cooldownTime} second{cooldownTime !== 1 ? 's' : ''} remaining
                    </div>
                ) : (
                    <div>Bell is ready to play!</div>
                )}
            </div>
        </div>
    );
};

export default AudioVolumeMonitor;
