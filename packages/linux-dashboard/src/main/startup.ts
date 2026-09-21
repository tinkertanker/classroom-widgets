export function isBackgroundLaunch(arguments_: readonly string[]): boolean {
  return arguments_.includes('--background');
}

export function hasExplicitOzonePlatform(arguments_: readonly string[]): boolean {
  return arguments_.some((argument) => /^--ozone-platform(?:=|$)/i.test(argument));
}

export function shouldForceX11(
  platform: NodeJS.Platform,
  environment: NodeJS.ProcessEnv,
  ozonePlatformSpecified: boolean,
): boolean {
  if (platform !== 'linux' || ozonePlatformSpecified) return false;

  const sessionType = environment.XDG_SESSION_TYPE?.trim().toLowerCase();
  if (sessionType) return sessionType === 'wayland';
  return Boolean(environment.WAYLAND_DISPLAY?.trim());
}

export function x11RelaunchArguments(
  platform: NodeJS.Platform,
  environment: NodeJS.ProcessEnv,
  arguments_: readonly string[],
): string[] | null {
  if (!shouldForceX11(platform, environment, hasExplicitOzonePlatform(arguments_))) return null;
  return [...arguments_.slice(1), '--ozone-platform=x11'];
}

export function relaunchExecutable(environment: NodeJS.ProcessEnv, executable: string): string {
  return environment.APPIMAGE?.trim() || executable;
}

export function migrateAutostartDesktopEntry(contents: string): string {
  let inDesktopEntry = false;
  return contents.split(/(\r?\n)/).map((line) => {
    const section = line.match(/^\s*\[([^\]]+)]\s*$/);
    if (section) {
      inDesktopEntry = section[1] === 'Desktop Entry';
      return line;
    }
    if (!inDesktopEntry) return line;

    const exec = line.match(/^(\s*Exec\s*=\s*)(.*?)(\s*)$/);
    if (!exec || /(?:^|\s)--background(?:\s|$)/.test(exec[2])) return line;
    return `${exec[1]}${exec[2]} --background${exec[3]}`;
  }).join('');
}
