// Browser compatibility utilities for voice control
// Simplified since annyang handles most cross-browser compatibility

export interface BrowserInfo {
  name: string;
  version: string;
  isSupported: boolean;
  supportLevel: 'full' | 'partial' | 'none';
  recommendations: string[];
}

export const getBrowserInfo = (): BrowserInfo => {
  const userAgent = navigator.userAgent.toLowerCase();

  // Detect browser
  const isChrome = userAgent.includes('chrome') && !userAgent.includes('edg');
  const isEdge = userAgent.includes('edg/');
  const isFirefox = userAgent.includes('firefox');
  const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');

  // Extract version
  const getVersion = (browserName: string) => {
    const match = userAgent.match(new RegExp(`${browserName}\\/(\\d+(\\.\\d+)*)`));
    return match ? match[1] : 'unknown';
  };

  // Annyang supports Chrome, Edge, and Firefox progressively
  // Safari has limited support
  if (isChrome) {
    return {
      name: 'Chrome',
      version: getVersion('chrome'),
      isSupported: true,
      supportLevel: 'full' as const,
      recommendations: []
    };
  }

  if (isEdge) {
    return {
      name: 'Edge',
      version: getVersion('edg'),
      isSupported: true,
      supportLevel: 'full' as const,
      recommendations: []
    };
  }

  if (isFirefox) {
    const version = getVersion('firefox');
    return {
      name: 'Firefox',
      version,
      isSupported: true,
      supportLevel: 'full' as const,
      recommendations: [
        'For best voice control experience in Firefox:',
        '1. Ensure microphone permissions are granted',
        '2. Use HTTPS connection (required for voice recognition)',
        '3. If needed, enable Web Speech API in about:config'
      ]
    };
  }

  if (isSafari) {
    return {
      name: 'Safari',
      version: getVersion('version'),
      isSupported: false,
      supportLevel: 'limited' as const,
      recommendations: [
        'Safari has limited voice control support',
        'For full voice control features, use Chrome, Edge, or Firefox',
        'Voice control may not work in Safari'
      ]
    };
  }

  // Unknown browser
  return {
    name: 'Unknown',
    version: 'unknown',
    isSupported: false,
    supportLevel: 'none' as const,
    recommendations: [
      'Browser not recognized',
      'Try Chrome, Edge, or Firefox for voice control'
    ]
  };
};

export const getBrowserSupportMessage = (browserInfo: BrowserInfo): string => {
  if (browserInfo.isSupported) {
    return browserInfo.recommendations.join('\n\n');
  }

  return browserInfo.recommendations.join('\n\n');
};

export const checkMicrophonePermission = async (): Promise<boolean> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop all tracks immediately
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Microphone permission check failed:', error);
    return false;
  }
};