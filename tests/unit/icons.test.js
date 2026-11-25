// SPDX-License-Identifier: GPL-2.0-or-later
// The icons a browser shows in its tab and a phone on its home screen: the goose, drawn by tools/make-icons.mjs
// from assets/icon-source.png. Every page names them: a page that does not makes the browser ask for
// /favicon.ico, which is not there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { icons, readPng } from '../../tools/make-icons.mjs';

const here = (path) => new URL('../../' + path, import.meta.url);
const ICONS = {
  'assets/icon-16.png': 16,
  'assets/icon-32.png': 32,
  'assets/icon-180.png': 180,
};

test('the icon files are what tools/make-icons.mjs draws', () => {
  const made = icons();
  assert.deepEqual(Object.keys(made).sort(), Object.keys(ICONS).sort());
  for (const [path, bytes] of Object.entries(made))
    assert.ok(
      readFileSync(here(path)).equals(bytes),
      `${path} is out of date: run node tools/make-icons.mjs`,
    );
});

test('each icon is the size its name says, and square', () => {
  for (const [path, size] of Object.entries(ICONS)) {
    const png = readFileSync(here(path));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [size, size], path);
  }
});

test('the tab icons are the circle, transparent round it; the phone one is solid, as phones need', () => {
  for (const path of ['assets/icon-16.png', 'assets/icon-32.png']) {
    const { w, h, px } = readPng(readFileSync(here(path))),
      alpha = (x, y) => px[(y * w + x) * 4 + 3],
      colours = new Set();
    for (const [x, y] of [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
    ])
      assert.equal(alpha(x, y), 0, `${path}: a corner is transparent`);
    assert.equal(alpha(w >> 1, h >> 1), 255, `${path}: the middle is solid`);
    for (let o = 0; o < px.length; o += 4) if (px[o + 3] === 255) colours.add(px.readUIntBE(o, 3));
    assert.ok(colours.size > 20, `${path}: a picture, not a blank (${colours.size} colours)`);
  }
  const phone = readFileSync(here('assets/icon-180.png'));
  assert.equal(phone[25], 2, 'the phone icon is RGB, with no transparency');
});

test('the icon source is the goose circle, transparent round it', () => {
  const { w, h, px } = readPng(readFileSync(here('assets/icon-source.png')));
  assert.deepEqual([w, h], [360, 360]);
  assert.equal(px[3], 0, 'a corner is transparent');
  assert.equal(px[(180 * w + 180) * 4 + 3], 255, 'the middle is solid');
});

for (const page of ['index.html', 'terms.html', 'privacy.html'])
  test(`${page} names the icons, and they exist`, () => {
    const html = readFileSync(here(page), 'utf8');
    for (const [rel, path, sizes] of [
      ['icon', 'assets/icon-32.png', '32x32'],
      ['icon', 'assets/icon-16.png', '16x16'],
      ['apple-touch-icon', 'assets/icon-180.png', null],
    ]) {
      const tag = html.match(new RegExp(`<link rel="${rel}" href="${path}"[^>]*>`));
      assert.ok(tag, `${page} has no <link rel="${rel}" href="${path}">`);
      if (sizes) assert.match(tag[0], new RegExp(`sizes="${sizes}"`));
      assert.ok(existsSync(here(path)), `${path} is missing`);
    }
  });
