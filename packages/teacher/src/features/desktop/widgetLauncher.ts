declare global {
  interface Window {
    openClassroomWidgetLauncher?: () => void;
  }
}

type WidgetLauncherOpener = () => void;

let opener: WidgetLauncherOpener | null = null;
let pendingOpen = false;

export function registerWidgetLauncherOpener(nextOpener: WidgetLauncherOpener): () => void {
  opener = nextOpener;
  if (pendingOpen) {
    pendingOpen = false;
    nextOpener();
  }

  return () => {
    if (opener === nextOpener) {
      opener = null;
    }
  };
}

export function openWidgetLauncher(): void {
  if (opener) {
    opener();
    pendingOpen = false;
    return;
  }

  pendingOpen = true;
}

export function bindWindowWidgetLauncher(prepare?: () => void): () => void {
  const bound = () => {
    prepare?.();
    openWidgetLauncher();
  };

  window.openClassroomWidgetLauncher = bound;

  return () => {
    if (window.openClassroomWidgetLauncher === bound) {
      delete window.openClassroomWidgetLauncher;
    }
  };
}

export function resetWidgetLauncherForTests(): void {
  opener = null;
  pendingOpen = false;
}
