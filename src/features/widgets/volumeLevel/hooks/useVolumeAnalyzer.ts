import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVolumeAnalyzerOptions {
  isEnabled: boolean;
  threshold: number;
  smoothingSamples?: number;
  updateInterval?: number;
  onThresholdExceeded?: () => void;
}

/**
 * Hook to analyze audio volume from an AnalyserNode
 * Provides RMS volume calculation with smoothing
 */
export function useVolumeAnalyzer({
  isEnabled,
  threshold,
  smoothingSamples = 10,
  updateInterval = 100,
  onThresholdExceeded
}: UseVolumeAnalyzerOptions) {
  const [volume, setVolume] = useState(0);
  const volumeHistoryRef = useRef<number[]>([]);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const isCooldownRef = useRef(false);
  const onThresholdExceededRef = useRef(onThresholdExceeded);

  // Update callback ref
  useEffect(() => {
    onThresholdExceededRef.current = onThresholdExceeded;
  }, [onThresholdExceeded]);

  // Reset volume when disabled
  useEffect(() => {
    if (!isEnabled) {
      setVolume(0);
      volumeHistoryRef.current = [];
    }
  }, [isEnabled]);

  const analyzeVolume = useCallback((analyser: AnalyserNode) => {
    if (!dataArrayRef.current) {
      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
    }

    analyser.getByteTimeDomainData(dataArrayRef.current);

    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      const value = dataArrayRef.current[i] - 128; // Centering the data around 0
      sum += value * value; // Squaring by multiplication for efficiency
    }
    const rms = Math.sqrt(sum / dataArrayRef.current.length);
    const normalizedVolume = (rms / 128) * 100; // Normalize the volume to a percentage

    // Add to volume history
    volumeHistoryRef.current.push(normalizedVolume);
    
    // Keep only the last smoothingSamples samples
    if (volumeHistoryRef.current.length > smoothingSamples) {
      volumeHistoryRef.current.shift();
    }
    
    // Calculate moving average
    const averageVolume = volumeHistoryRef.current.reduce((a, b) => a + b, 0) / volumeHistoryRef.current.length;
    
    setVolume(Math.min(averageVolume, 100)); // Cap at 100%

    // Check if the average volume exceeds the threshold and cooldown is not active
    if (isEnabled && averageVolume > threshold && !isCooldownRef.current) {
      onThresholdExceededRef.current?.();
    }

    return averageVolume;
  }, [isEnabled, threshold, smoothingSamples]);

  const setCooldown = useCallback((active: boolean) => {
    isCooldownRef.current = active;
  }, []);

  const startMonitoring = useCallback((analyser: AnalyserNode) => {
    const intervalId = setInterval(() => {
      analyzeVolume(analyser);
    }, updateInterval);

    return () => {
      clearInterval(intervalId);
      dataArrayRef.current = null;
    };
  }, [analyzeVolume, updateInterval]);

  return {
    volume,
    normalizedVolume: threshold > 0 ? Math.min(volume / threshold, 1) : 0,
    startMonitoring,
    setCooldown
  };
}