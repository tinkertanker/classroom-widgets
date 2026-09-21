import { basename } from 'node:path';

export function isBackgroundLaunch(arguments_: readonly string[]): boolean {
  return arguments_.includes('--background');
}

function trimAsciiWhitespace(value: string): string {
  return value.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '');
}

function chromiumArguments(arguments_: readonly string[]): readonly string[] {
  const terminator = arguments_.findIndex((argument) => trimAsciiWhitespace(argument) === '--');
  return terminator === -1 ? arguments_ : arguments_.slice(0, terminator);
}

function ozonePlatform(arguments_: readonly string[]): string | undefined {
  let value: string | undefined;
  for (const argument of chromiumArguments(arguments_)) {
    const trimmed = trimAsciiWhitespace(argument);
    const prefixLength = trimmed.startsWith('--') ? 2 : (trimmed.startsWith('-') ? 1 : 0);
    if (prefixLength === 0 || prefixLength === trimmed.length) continue;
    const separator = trimmed.indexOf('=');
    const nameEnd = separator === -1 ? trimmed.length : separator;
    if (trimmed.slice(prefixLength, nameEnd) !== 'ozone-platform') continue;
    value = separator === -1 ? '' : trimmed.slice(separator + 1);
  }
  return value;
}

export function hasExplicitOzonePlatform(arguments_: readonly string[]): boolean {
  return ozonePlatform(arguments_) !== undefined;
}

export function effectiveOzonePlatformArgument(arguments_: readonly string[]): string {
  const value = ozonePlatform(arguments_);
  if (value === undefined) return '';
  return value ? `--ozone-platform=${value}` : '--ozone-platform';
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
  const relaunchArguments = [...arguments_.slice(1)];
  const terminator = relaunchArguments.findIndex((argument) => trimAsciiWhitespace(argument) === '--');
  relaunchArguments.splice(terminator === -1 ? relaunchArguments.length : terminator, 0, '--ozone-platform=x11');
  return relaunchArguments;
}

export function relaunchExecutable(environment: NodeJS.ProcessEnv, executable: string): string {
  return environment.APPIMAGE?.trim() || executable;
}

export function appImageUpdateRelaunchDelay(environment: NodeJS.ProcessEnv, siblingNames: readonly string[]): number {
  const appImage = environment.APPIMAGE?.trim();
  if (!appImage) return 0;
  const backupPrefix = `${basename(appImage)}.previous-`;
  return siblingNames.some((name) => name.startsWith(backupPrefix)) ? 3000 : 0;
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
