import { FaApple, FaWindows, FaLinux } from 'react-icons/fa6';

export const desktopPlatforms = [
  { id: 'windows', name: 'Windows', icon: FaWindows, format: 'Installer · .exe', requirements: 'Windows 10 (1809+) / 11 · 64-bit · WebView2' },
  { id: 'macos', name: 'macOS', icon: FaApple, format: 'Disk image · .dmg', requirements: 'macOS 13 or later' },
  { id: 'linux', name: 'Linux', icon: FaLinux, format: 'Portable · .AppImage', requirements: '64-bit · System tray (GNOME: AppIndicator)' },
] as const;
