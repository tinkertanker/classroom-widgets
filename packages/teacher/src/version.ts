declare global {
  interface Window {
    __CLASSROOM_WIDGETS_MACOS_VERSION__?: string;
  }
}

const WEB_BUILD_ID = import.meta.env.VITE_BUILD_ID?.trim() || 'development';

export function getReleaseLabel() {
  const macOSVersion = typeof window === 'undefined'
    ? undefined
    : window.__CLASSROOM_WIDGETS_MACOS_VERSION__;

  return macOSVersion ? `macOS v${macOSVersion}` : `Web ${WEB_BUILD_ID}`;
}
