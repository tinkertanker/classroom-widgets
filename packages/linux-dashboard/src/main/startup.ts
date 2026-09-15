export function isBackgroundLaunch(arguments_: readonly string[]): boolean {
  return arguments_.includes('--background');
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
