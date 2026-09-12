declare global {
  interface Window {
    __CLASSROOM_WIDGETS_MACOS_VERSION__?: string;
    __CLASSROOM_WIDGETS_WINDOWS_VERSION__?: string;
  }
}

const WEB_BUILD_ID = import.meta.env.VITE_BUILD_ID?.trim() || 'development';

export function getReleaseLabel() {
  if (typeof window !== 'undefined') {
    if (window.__CLASSROOM_WIDGETS_MACOS_VERSION__) return `macOS v${window.__CLASSROOM_WIDGETS_MACOS_VERSION__}`;
    if (window.__CLASSROOM_WIDGETS_WINDOWS_VERSION__) return `Windows v${window.__CLASSROOM_WIDGETS_WINDOWS_VERSION__}`;
  }

  return `Web ${WEB_BUILD_ID}`;
}
