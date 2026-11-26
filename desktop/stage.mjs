// SPDX-License-Identifier: GPL-2.0-or-later
// Copies the game into dist/ for the app to package, or into the folder given, for GitHub Pages. Only what the
// game loads goes in: not the tests, the tooling or node_modules, which the folder above also holds.
//
//   node stage.mjs [folder]
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const game = join(here, '..');
const dist = process.argv[2] ? resolve(process.argv[2]) : join(here, 'dist');
export const FILES = [
  'index.html',
  'terms.html',
  'privacy.html',
  'sidplayer.js',
  'LICENSE',
  'js',
  'assets',
  'radio/stations.json',
  'usbsid-player/LICENSE',
  'usbsid-player/README.md',
  'usbsid-player/usbsid.esm.js',
  'usbsid-player/usbsid.wasm',
  'usbsid-player/usplayer-audio.js',
  'usbsid-player/usplayer-web.js',
  'tools/presence-bridge/schema.json',
];

rmSync(dist, { recursive: true, force: true });
for (const f of FILES) {
  mkdirSync(dirname(join(dist, f)), { recursive: true });
  cpSync(join(game, f), join(dist, f), { recursive: true });
}
// The page's own Content-Security-Policy is for GitHub Pages, which cannot send one as a header. The app has its
// own, in tauri.conf.json, and both would apply at once: the page's would block the app's IPC and the scripts
// Tauri adds. So the app's copy goes without it.
if (!process.argv[2]) {
  const page = join(dist, 'index.html'),
    html = readFileSync(page, 'utf8'),
    bare = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n/, '');
  if (bare === html) throw new Error('index.html: no Content-Security-Policy meta tag to take out');
  writeFileSync(page, bare);
}
console.log(`staged ${FILES.length} entries in ${dist}`);
