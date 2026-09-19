import { app, dialog, MessageBoxOptions, MessageBoxReturnValue, net, shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, copyFile, mkdtemp, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { log } from './log';
import { isNewerVersion, parseUpdateRelease, ReleaseAsset } from './updateRelease';

const LATEST_RELEASE_API = 'https://api.github.com/repos/tinkertanker/classroom-widgets/releases/latest';
const execFileAsync = promisify(execFile);

interface UpdateControllerDependencies {
  isPackaged: () => boolean;
  fetch: typeof net.fetch;
  showMessageBox: (options: MessageBoxOptions) => Promise<MessageBoxReturnValue>;
  openExternal: typeof shell.openExternal;
  openPath: (path: string) => Promise<string>;
  execFile: (file: string, args: string[]) => Promise<unknown>;
  relaunch: () => void;
  download: (asset: ReleaseAsset) => Promise<string>;
  installAppImage: (download: string) => Promise<void>;
  installDeb: (download: string, releasePage: string) => Promise<void>;
}

export class UpdateController {
  private checking = false;
  private readonly dependencies: UpdateControllerDependencies;

  constructor(private readonly currentVersion: string, private readonly onQuit: () => void, dependencies: Partial<UpdateControllerDependencies> = {}) {
    this.dependencies = {
      isPackaged: () => app.isPackaged,
      fetch: (...args) => net.fetch(...args),
      showMessageBox: (options) => dialog.showMessageBox(options),
      openExternal: (...args) => shell.openExternal(...args),
      openPath: (path) => shell.openPath(path),
      execFile: (file, args) => execFileAsync(file, args),
      relaunch: () => app.relaunch(),
      download: (asset) => this.download(asset),
      installAppImage: (download) => this.installAppImage(download),
      installDeb: (download, releasePage) => this.installDeb(download, releasePage),
      ...dependencies,
    };
  }

  async check(manual = false): Promise<void> {
    if (this.checking || !this.dependencies.isPackaged()) return;
    this.checking = true;
    try {
      const response = await this.dependencies.fetch(LATEST_RELEASE_API, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': `ClassroomWidgets/${this.currentVersion}` },
      });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      const release = parseUpdateRelease(await response.json());
      if (!release) throw new Error('GitHub returned an invalid release');
      if (!isNewerVersion(release.version, this.currentVersion)) {
        if (manual) await this.dependencies.showMessageBox({ type: 'info', message: 'Classroom Widgets is up to date.', detail: `Version ${this.currentVersion} is the latest version.` });
        return;
      }

      const appImage = Boolean(process.env.APPIMAGE);
      const suffix = appImage ? '-linux-x86_64.AppImage' : '-linux-amd64.deb';
      const asset = release.assets.find((candidate) => candidate.name === `ClassroomWidgets-v${release.version}${suffix}`);
      if (!asset) {
        await this.openReleaseFallback(release.pageUrl, `Version ${release.version} is available, but its Linux package is not attached yet.`);
        return;
      }

      const answer = await this.dependencies.showMessageBox({
        type: 'info',
        buttons: ['Install and Restart', 'Later'],
        defaultId: 0,
        cancelId: 1,
        message: `Classroom Widgets ${release.version} is available.`,
        detail: `You are using version ${this.currentVersion}. The update will be downloaded and the app will restart.`,
      });
      if (answer.response !== 0) return;

      try {
        const packagePath = await this.dependencies.download(asset);
        if (appImage) await this.dependencies.installAppImage(packagePath);
        else await this.dependencies.installDeb(packagePath, release.pageUrl);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        log.warn(`Update installation failed: ${reason}`);
        const recovery = appImage
          ? `Make sure the AppImage location (${process.env.APPIMAGE ?? 'unknown'}) is writable, or download the update manually.`
          : 'Download the update manually and install it with your package manager.';
        await this.openReleaseFallback(release.pageUrl, `${reason}\n\n${recovery}`, 'Unable to install update.');
      }
    } catch (error) {
      log.warn(`Update check failed: ${error instanceof Error ? error.message : String(error)}`);
      if (manual) await this.dependencies.showMessageBox({ type: 'warning', message: 'Unable to check for updates.', detail: 'Check your connection and try again.' });
    } finally {
      this.checking = false;
    }
  }

  private async download(asset: ReleaseAsset): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'classroom-widgets-update-'));
    const destination = join(directory, basename(asset.name));
    const response = await net.fetch(asset.browser_download_url, { redirect: 'follow' });
    if (!response.ok || !response.body) throw new Error(`Update download returned ${response.status}`);
    await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>), createWriteStream(destination));
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(destination)) hash.update(chunk);
    if (`sha256:${hash.digest('hex')}` !== asset.digest) throw new Error('Update checksum verification failed');
    return destination;
  }

  private async installAppImage(download: string): Promise<void> {
    const current = process.env.APPIMAGE;
    if (!current) throw new Error('The running AppImage path is unavailable');
    const token = randomUUID();
    const staged = `${current}.update-${token}`;
    const backup = `${current}.previous-${token}`;
    await copyFile(download, staged);
    await chmod(staged, 0o755);
    if (await this.sha256(staged) !== await this.sha256(download)) {
      await unlink(staged).catch(() => undefined);
      throw new Error('Update staging verification failed');
    }
    await unlink(download).catch(() => undefined);

    const script = join(tmpdir(), `classroom-widgets-update-${token}.sh`);
    await writeFile(script, '#!/bin/sh\nwhile kill -0 "$1" 2>/dev/null; do sleep 1; done\nif ! mv "$3" "$4"; then rm -f "$2" "$5"; exit 1; fi\nif mv "$2" "$3" && chmod +x "$3"; then\n  "$3" >/dev/null 2>&1 &\n  replacement_pid=$!\n  sleep 2\n  if kill -0 "$replacement_pid" 2>/dev/null; then rm -f "$4"; exit 0; fi\nfi\nrm -f "$3"\nmv "$4" "$3"\n"$3" >/dev/null 2>&1 &\nrm -f "$5"\n');
    const child = spawn('/bin/sh', [script, String(process.pid), staged, current, backup, script], { detached: true, stdio: 'ignore' });
    try {
      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
      });
    } catch (error) {
      await Promise.all([unlink(staged).catch(() => undefined), unlink(script).catch(() => undefined)]);
      throw error;
    }
    child.unref();
    this.onQuit();
  }

  private async sha256(path: string): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest('hex');
  }

  private async installDeb(download: string, _releasePage: string): Promise<void> {
    try {
      await this.dependencies.execFile('pkexec', ['apt-get', 'install', '-y', download]);
      this.dependencies.relaunch();
      this.onQuit();
    } catch (error) {
      const installReason = error instanceof Error ? error.message : String(error);
      log.warn(`Package-manager update failed: ${installReason}`);
      let openReason: string;
      try {
        const opened = await this.dependencies.openPath(download);
        if (!opened) return;
        openReason = opened;
      } catch (openError) {
        openReason = openError instanceof Error ? openError.message : String(openError);
      }
      throw new Error(`Package manager failed: ${installReason}\nOpening the downloaded package failed: ${openReason}`);
    }
  }

  private async openReleaseFallback(pageUrl: string, detail: string, message = 'Update available'): Promise<void> {
    const answer = await this.dependencies.showMessageBox({ type: 'info', buttons: ['Open Downloads', 'Cancel'], defaultId: 0, cancelId: 1, message, detail });
    if (answer.response === 0) {
      try {
        await this.dependencies.openExternal(pageUrl);
      } catch (error) {
        log.warn(`Unable to open the release page: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
