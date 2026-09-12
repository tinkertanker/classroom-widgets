import { shell, WebContents } from 'electron';
import { isAllowed, ORIGIN } from './appProtocol';
import { log } from './log';

const configuredSessions = new WeakSet<Electron.Session>();

function openExternally(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
  shell.openExternal(parsed.toString()).catch((error: unknown) => {
    log.warn(`Unable to open external link: ${error instanceof Error ? error.message : String(error)}`);
  });
}

function configureSession(contents: WebContents): void {
  const session = contents.session;
  if (configuredSessions.has(session)) return;
  configuredSessions.add(session);
  session.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    const ours = url.startsWith(`${ORIGIN}/`) || url === ORIGIN;
    const allowed = ours && (permission === 'media' || permission === 'clipboard-read' || permission === 'fullscreen');
    callback(allowed);
  });
}

/**
 * The wiring every surface needs: navigation locked to the app origin,
 * external links handed to the system browser, and optional devtools.
 * `render-process-gone` is left to each caller.
 */
export function configureWebContents(contents: WebContents): void {
  configureSession(contents);

  contents.on('will-navigate', (event, url) => {
    if (isAllowed(url)) return;
    event.preventDefault();
    openExternally(url);
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (!isAllowed(url)) openExternally(url);
    return { action: 'deny' };
  });

  if (process.env.CLASSROOM_WIDGETS_DEVTOOLS === '1') {
    contents.once('did-finish-load', () => {
      contents.openDevTools({ mode: 'detach' });
    });
  }

  contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      log.error(`Navigation failed (${errorCode}) ${errorDescription} for ${validatedURL}`);
    }
  });
}

/** Runs a script and returns its result, or null when it throws. */
export async function evaluate(contents: WebContents, script: string): Promise<unknown> {
  if (contents.isDestroyed()) return null;
  try {
    return await contents.executeJavaScript(script, true);
  } catch (error) {
    log.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function evaluateBool(contents: WebContents, script: string): Promise<boolean> {
  const result = await evaluate(contents, script);
  return result === true;
}
