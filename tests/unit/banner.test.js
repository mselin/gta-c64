// SPDX-License-Identifier: GPL-2.0-or-later
// The large text across the middle of the screen (busted, flatlined, a job starting or ending) and the line or
// lines under it: everything the game can put there fits the 320-pixel screen.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JOBS, SW } from '../../js/config.js';
import { BANNER_COLS, G, bigText, resetState } from '../../js/state.js';
import { wrap, wrapEven } from '../../js/util.js';
import { down, hurt } from '../../js/player.js';

const COLS = SW / 8; // 8-pixel characters across the screen
const fits = (b) => {
  assert.ok(b.big ? b.t.length * 16 <= SW - 16 : b.t.length <= COLS - 2, `"${b.t}" fits across`);
  assert.ok(b.lines.length >= 1 && b.lines.length <= 3, `"${b.sub}" takes 1 to 3 lines`);
  for (const line of b.lines) assert.ok(line.length <= BANNER_COLS, `"${line}" fits across`);
  assert.equal(b.lines.join(' '), b.sub.split(' ').filter(Boolean).join(' '), 'no words lost');
};

beforeEach(() => {
  resetState();
  G.screen = 'play';
});

test('wrap breaks text at spaces into lines of at most n characters', () => {
  assert.deepEqual(wrap('THOUGHTS AND PRAYERS HAVE BEEN DISPATCHED', 38), [
    'THOUGHTS AND PRAYERS HAVE BEEN',
    'DISPATCHED',
  ]);
  assert.deepEqual(wrap('SHORT', 38), ['SHORT']);
  assert.deepEqual(wrap('  A  B ', 38), ['A B']);
  assert.deepEqual(
    wrap('ABCDEFGHIJ KL', 4),
    ['ABCD', 'EFGH', 'IJ', 'KL'],
    'a word too long for a line is cut',
  );
  assert.deepEqual(wrap('', 38), []);
  // In as few lines, as even as they go.
  assert.deepEqual(wrapEven('THOUGHTS AND PRAYERS HAVE BEEN DISPATCHED', 38), [
    'THOUGHTS AND PRAYERS',
    'HAVE BEEN DISPATCHED',
  ]);
  assert.deepEqual(wrapEven('YOUR NO-CLAIMS BONUS IS GONE. SO ARE YOU.', 38), [
    'YOUR NO-CLAIMS BONUS',
    'IS GONE. SO ARE YOU.',
  ]);
  assert.deepEqual(wrapEven('SHORT ENOUGH FOR ONE LINE', 38), ['SHORT ENOUGH FOR ONE LINE']);
  assert.deepEqual(
    wrapEven('A SUPERCALIFRAGILISTIC B', 20),
    ['A', 'SUPERCALIFRAGILISTIC', 'B'],
    'no word cut',
  );
  assert.equal(BANNER_COLS, COLS - 2, 'a character of margin each side');
});

test('busted and flatlined, with every reason the game gives, fit the screen', () => {
  down('dead');
  fits(G.banner);
  assert.equal(G.banner.lines.length, 2, 'the 41-character default now takes two lines');
  resetState();
  G.screen = 'play';
  down('busted');
  fits(G.banner);
  resetState();
  G.screen = 'play';
  hurt(999, 'YOUR NO-CLAIMS BONUS IS GONE. SO ARE YOU.');
  assert.equal(G.screen, 'down');
  fits(G.banner);
});

test('every job title fits in big letters, with its reward under it', () => {
  for (const def of JOBS) {
    bigText(def.t, 'REWARD $' + 99999, 7, 2.5);
    assert.ok(G.banner.big, `${def.t} in big letters`);
    fits(G.banner);
  }
});

test('a title too long for big letters is drawn small instead', () => {
  bigText('A TITLE OF TWENTY-ONE', 'X', 7);
  assert.equal(G.banner.big, false);
  fits(G.banner);
});

test('every text the code passes to a banner fits the screen', () => {
  // Each string literal in a call that can put up a banner: bigText, down and hurt (the reason the player went
  // down) and failJob (why a job went wrong).
  const dir = new URL('../../js/', import.meta.url),
    found = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const [, name, args] of src.matchAll(/\b(bigText|down|hurt|failJob)\(([^;]*?)\);/gs))
      for (const [, , s] of args.matchAll(/(['"])((?:(?!\1).)+)\1/g))
        if (!['dead', 'busted'].includes(s)) found.push([f, name, s]);
  }
  assert.ok(found.length >= 10, `found the banner texts (${found.length})`);
  for (const [f, name, s] of found)
    assert.ok(wrapEven(s, BANNER_COLS).length <= 3, `${f} ${name}: "${s}" takes at most 3 lines`);
  // Titles: the first argument of bigText where it is written out.
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const [, t] of src.matchAll(/\bbigText\('([^']+)'/g))
      assert.ok(t.length * 16 <= SW - 16, `${f}: "${t}"`);
  }
});
