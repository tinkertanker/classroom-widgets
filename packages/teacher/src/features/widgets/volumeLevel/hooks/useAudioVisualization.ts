import { useState, useMemo } from 'react';
import { useAnimationFrame } from '@shared/hooks/useAnimationFrame';

interface UseAudioVisualizationOptions {
  isEnabled: boolean;
  normalizedVolume: number;
  barCount?: number;
  width?: number;
  height?: number;
}

interface Bar {
  x: number;
  y1: number;
  y2: number;
  barHeight: number;
}

/**
 * Hook to generate oscilloscope-style audio visualization
 * Creates animated waveform bars based on volume levels
 */
export function useAudioVisualization({
  isEnabled,
  normalizedVolume,
  barCount = 60,
  width = 300,
  height = 100
}: UseAudioVisualizationOptions) {
  const [animationTime, setAnimationTime] = useState(0);

  // Animate the waveform
  useAnimationFrame(
    () => {
      setAnimationTime(prev => prev + 0.02);
    },
    { isActive: isEnabled }
  );

  // Generate visualization data
  const visualizationData = useMemo(() => {
    const centerY = height / 2;
    const amplitude = normalizedVolume * 40; // Max amplitude
    const barWidth = width / barCount;
    const barSpacing = barWidth * 0.8; // 80% bar, 20% gap
    
    // Generate bars
    const bars: Bar[] = [];
    
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

    return {
      bars,
      strokeColor,
      centerY,
      barSpacing,
      rgb: { r, g, b }
    };
  }, [normalizedVolume, animationTime, barCount, width, height]);

  return visualizationData;
}