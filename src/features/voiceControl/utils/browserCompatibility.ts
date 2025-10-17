// Browser compatibility utilities for voice control

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
  const isFirefox = userAgent.includes('firefox');
  const isChrome = userAgent.includes('chrome') && !userAgent.includes('edg');
  const isEdge = userAgent.includes('edg/');
  const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');

  // Extract version
  const getVersion = (browserName: string) => {
    const match = userAgent.match(new RegExp(`${browserName}\\/(\\d+(\\.\\d+)*)`));
    return match ? match[1] : 'unknown';
  };

  if (isFirefox) {
    const version = getVersion('firefox');
    const versionNum = parseInt(version.split('.')[0]);

    // Firefox 142+ disabled Web Speech API by default
    if (versionNum >= 142) {
      return {
        name: 'Firefox',
        version,
        isSupported: false,
        supportLevel: 'none' as const,
        recommendations: [
          'Enable Web Speech API in Firefox:',
          '1. Type "about:config" in address bar',
          '2. Search for "media.webspeech.recognition.enable"',
          '3. Set the value to "true"',
          '4. Restart Firefox',
          '',
          'Or use Chrome/Edge for best experience'
        ]
      };
    }

    return {
      name: 'Firefox',
      version,
      isSupported: true,
      supportLevel: 'full' as const,
      recommendations: []
    };
  }

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

  if (isSafari) {
    return {
      name: 'Safari',
      version: getVersion('version'),
      isSupported: false,
      supportLevel: 'none' as const,
      recommendations: [
        'Safari does not support Web Speech API',
        'Use Chrome, Edge, or Firefox for voice control',
        'Consider using a different browser'
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
    return '';
  }

  if (browserInfo.name === 'Firefox') {
    return browserInfo.recommendations.join('\n');
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