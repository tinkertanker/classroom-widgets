import { app, dialog, net, shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { log } from './log';
import { isNewerVersion, parseUpdateRelease, ReleaseAsset } from './updateRelease';

const LATEST_RELEASE_API = 'https://api.github.com/repos/tinkertanker/classroom-widgets/releases/latest';
const execFileAsync = promisify(execFile);

export class UpdateController {
  private checking = false;

  constructor(private readonly currentVersion: string, private readonly onQuit: () => void) {}

  async check(manual = false): Promise<void> {
    if (this.checking || !app.isPackaged) return;
    this.checking = true;
    try {
      const response = await net.fetch(LATEST_RELEASE_API, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': `ClassroomWidgets/${this.currentVersion}` },
      });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      const release = parseUpdateRelease(await response.json());
      if (!release) throw new Error('GitHub returned an invalid release');
      if (!isNewerVersion(release.version, this.currentVersion)) {
        if (manual) await dialog.showMessageBox({ type: 'info', message: 'Classroom Widgets is up to date.', detail: `Version ${this.currentVersion} is the latest version.` });
        return;
      }

      const appImage = Boolean(process.env.APPIMAGE);
      const suffix = appImage ? '-linux-x86_64.AppImage' : '-linux-amd64.deb';
      const asset = release.assets.find((candidate) => candidate.name === `ClassroomWidgets-v${release.version}${suffix}`);
      if (!asset) {
        await this.openReleaseFallback(release.pageUrl, `Version ${release.version} is available, but its Linux package is not attached yet.`);
        return;
      }

      const answer = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Install and Restart', 'Later'],
        defaultId: 0,
        cancelId: 1,
        message: `Classroom Widgets ${release.version} is available.`,
        detail: `You are using version ${this.currentVersion}. The update will be downloaded and the app will restart.`,
      });
      if (answer.response !== 0) return;

      const packagePath = await this.download(asset);
      if (appImage) await this.installAppImage(packagePath);
      else await this.installDeb(packagePath, release.pageUrl);
    } catch (error) {
      log.warn(`Update check failed: ${error instanceof Error ? error.message : String(error)}`);
      if (manual) await dialog.showMessageBox({ type: 'warning', message: 'Unable to check for updates.', detail: 'Check your connection and try again.' });
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
    await chmod(download, 0o755);
    const script = join(tmpdir(), `classroom-widgets-update-${process.pid}.sh`);
    await writeFile(script, '#!/bin/sh\nwhile kill -0 "$1" 2>/dev/null; do sleep 1; done\nmv "$2" "$3" && chmod +x "$3" && "$3" >/dev/null 2>&1 &\nrm -f "$0"\n');
    await chmod(script, 0o755);
    const child = spawn(script, [String(process.pid), download, current], { detached: true, stdio: 'ignore' });
    child.unref();
    this.onQuit();
  }

  private async installDeb(download: string, releasePage: string): Promise<void> {
    try {
      await execFileAsync('pkexec', ['apt-get', 'install', '-y', download]);
      app.relaunch();
      this.onQuit();
    } catch (error) {
      log.warn(`Package-manager update failed: ${error instanceof Error ? error.message : String(error)}`);
      const opened = await shell.openPath(download);
      if (opened) await this.openReleaseFallback(releasePage, 'The package manager could not install the update automatically.');
    }
  }

  private async openReleaseFallback(pageUrl: string, detail: string): Promise<void> {
    const answer = await dialog.showMessageBox({ type: 'info', buttons: ['Open Downloads', 'Cancel'], defaultId: 0, cancelId: 1, message: 'Update available', detail });
    if (answer.response === 0) await shell.openExternal(pageUrl);
  }
}
