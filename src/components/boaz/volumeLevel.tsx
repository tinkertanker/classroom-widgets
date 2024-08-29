import {
    Box,
    Card,
    CardBody,
    CardHeader,
    Heading,
    Input,
    Text,
    VStack,
    HStack,
} from '@chakra-ui/react';
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
        <Card
            width="100%"
            height="100%"
            borderWidth='1px'
            borderRadius='md'
            boxShadow='md'
            overflow='hidden'
            display='flex'
            flexDirection='column'
        >
            <CardHeader>
                <Heading as='h3' size='md' mb={2}>
                    Audio Volume Monitor
                </Heading>
                <VStack align='stretch' spacing={4}>
                    <Box>
                        <Text fontSize='sm' mb={2}>
                            Set Volume Threshold
                        </Text>
                        <Input
                            type='range'
                            min='0'
                            max='100'
                            value={threshold}
                            onChange={(e) => setThreshold(Number(e.target.value))}
                            aria-label='Volume Threshold'
                        />
                        <Text mt={2} fontSize='sm'>
                            Threshold: {threshold}
                        </Text>
                    </Box>
                    <Box>
                        <Text fontSize='sm'>Volume Level: {volume.toFixed(2)}</Text>
                    </Box>
                </VStack>
            </CardHeader>
            <CardBody flex='1' >
                <Box
                    width='100%'
                    height='20px'
                    background='gray.200'
                    borderRadius='md'
                    position='relative'
                >
                    <Box
                        width={`${volume}%`} // Use volume to determine width
                        height='100%'
                        background={volume > threshold ? 'red.500' : 'green.500'}
                        borderRadius='md'
                        transition='width 0.2s ease'
                    ></Box>
                </Box>
                <HStack mt={4} spacing={4} justify='space-between'>
                    <Text fontSize='sm'>Cooldown Timer:</Text>
                    {isCooldownRef.current ? (
                        <Text fontSize='sm' color='red.500'>
                            {cooldownTime} second{cooldownTime !== 1 ? 's' : ''}
                            remaining
                        </Text>
                    ) : (
                        <Text fontSize='sm' color='green.500'>
                            Bell is ready to play!
                        </Text>
                    )}
                </HStack>
            </CardBody>
        </Card>
    );
};

export default AudioVolumeMonitor;
