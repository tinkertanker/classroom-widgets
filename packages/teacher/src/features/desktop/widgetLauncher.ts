declare global {
  interface Window {
    openClassroomWidgetLauncher?: () => void;
    cancelClassroomWidgetLauncher?: () => void;
  }
}

type WidgetLauncherOpener = () => void;

let opener: WidgetLauncherOpener | null = null;
let closer: WidgetLauncherOpener | null = null;
let pendingOpen = false;

export function registerWidgetLauncherOpener(
  nextOpener: WidgetLauncherOpener,
  nextCloser?: WidgetLauncherOpener
): () => void {
  opener = nextOpener;
  closer = nextCloser ?? null;
  if (pendingOpen) {
    pendingOpen = false;
    nextOpener();
  }

  return () => {
    if (opener === nextOpener) {
      opener = null;
      if (closer === nextCloser) {
        closer = null;
      }
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

export function cancelWidgetLauncher(): void {
  pendingOpen = false;
  closer?.();
}

export function bindWindowWidgetLauncher(prepare?: () => void): () => void {
  const bound = () => {
    prepare?.();
    openWidgetLauncher();
  };

  window.openClassroomWidgetLauncher = bound;
  window.cancelClassroomWidgetLauncher = cancelWidgetLauncher;

  return () => {
    if (window.openClassroomWidgetLauncher === bound) {
      delete window.openClassroomWidgetLauncher;
    }
    if (window.cancelClassroomWidgetLauncher === cancelWidgetLauncher) {
      delete window.cancelClassroomWidgetLauncher;
    }
  };
}

export function resetWidgetLauncherForTests(): void {
  opener = null;
  closer = null;
  pendingOpen = false;
}
