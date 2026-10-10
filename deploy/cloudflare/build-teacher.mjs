#!/usr/bin/env node
// Builds the teacher app for widgets.tk.sg and stages it, with the _headers
// file, in web/dist for the classroom-widgets-web Worker.
//
// Mirrors Dockerfile.prod: VITE_* values come from the environment, with the
// production defaults below. VITE_BUILD_ID defaults to the 7-character commit
// SHA, as the Deploy Web to Production workflow sets it.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const teacherBuild = join(repoRoot, 'packages', 'teacher', 'build');
const dist = join(here, 'web', 'dist');

const git = (...args) =>
  execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();

if (git('status', '--porcelain', '--', 'packages', 'scripts', 'package.json', 'pnpm-lock.yaml')) {
  console.warn('warning: the app sources have uncommitted changes; the build ID will not match them.');
}

const viteEnv = {
  VITE_SERVER_URL: process.env.VITE_SERVER_URL || 'https://go.tk.sg',
  VITE_LINK_SHORTENER_ENABLED: process.env.VITE_LINK_SHORTENER_ENABLED || 'true',
  VITE_UMAMI_SCRIPT_URL: process.env.VITE_UMAMI_SCRIPT_URL || '',
  VITE_UMAMI_WEBSITE_ID: process.env.VITE_UMAMI_WEBSITE_ID || '',
  VITE_BUILD_ID: process.env.VITE_BUILD_ID || git('rev-parse', '--short=7', 'HEAD'),
};
console.log('Building teacher app with', viteEnv);

execFileSync('pnpm', ['install', '--frozen-lockfile', '--filter', '@classroom-widgets/teacher...'], {
  cwd: repoRoot,
  stdio: 'inherit',
});
execFileSync('pnpm', ['--filter', '@classroom-widgets/teacher', 'build'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: { ...process.env, ...viteEnv },
});

rmSync(dist, { recursive: true, force: true });
cpSync(teacherBuild, dist, { recursive: true });
cpSync(join(here, 'web', '_headers'), join(dist, '_headers'));

// Fail loudly if the bundle does not point at the intended backend.
const assets = join(dist, 'assets');
const bundled = existsSync(assets)
  ? readdirSync(assets)
      .filter((f) => f.endsWith('.js'))
      .some((f) => readFileSync(join(assets, f), 'utf8').includes(viteEnv.VITE_SERVER_URL))
  : false;
if (!bundled) {
  throw new Error(`No bundle in ${assets} references ${viteEnv.VITE_SERVER_URL}`);
}
console.log(`Staged ${dist} (build ${viteEnv.VITE_BUILD_ID}, server ${viteEnv.VITE_SERVER_URL})`);
