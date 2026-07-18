import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = path.join(root, 'apps', 'widget-player', 'dist');
const destination = path.join(root, 'apps', 'ipad', 'Resources', 'widget-player');

await access(path.join(source, 'index.html'));
if (destination !== path.join(root, 'apps', 'ipad', 'Resources', 'widget-player')) {
  throw new Error('Refusing to replace an unexpected widget-player destination.');
}
// The Vite filenames are content-hashed. Replace this generated resource directory so an
// Xcode archive can never retain executable assets from an earlier player build.
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, force: true });

process.stdout.write(`Synced the production widget player to ${destination}\n`);
