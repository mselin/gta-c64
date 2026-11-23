// SPDX-License-Identifier: GPL-2.0-or-later
// The scale (specs/design.md, "The scale"): the city drawn ZOOM screen pixels to a city pixel, people their size
// on screen. Whatever the scale, a person must look, move and reach the same on screen; changing it in play keeps
// everyone where they are; the choice is remembered.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ZOOM,
  HIT,
  MELEE,
  NOTICE,
  PACE,
  PERSON,
  PICKUP,
  VIEW_H,
  VIEW_W,
  ZOOM,
  ZOOMS,
  setZoom,
} from '../../js/config.js';
import { foot, genMap } from '../../js/world.js';
import { G, P, resetState } from '../../js/state.js';
import { mkPed } from '../../js/entities.js';
import { touchReach } from '../../js/player.js';
import { loadZoom, nextZoom, useZoom } from '../../js/scale.js';

// Node has no localStorage: a stand-in, so the remembered choice can be checked.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

before(() => genMap());
beforeEach(() => {
  setZoom(DEFAULT_ZOOM);
  resetState();
  store.clear();
});
after(() => setZoom(DEFAULT_ZOOM));
/** Equal but for floating point: a third of seven, times three, is 6.999999999999999. */
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} ${a} against ${b}`);

test('the default is 2, and the choices are 1, 2 and 3', () => {
  assert.equal(DEFAULT_ZOOM, 2);
  assert.deepEqual(ZOOMS, [1, 2, 3]);
});

test('at every scale a person looks, moves and reaches the same on screen', () => {
  for (const z of ZOOMS) {
    setZoom(z);
    const screen = (cityPixels) => cityPixels * ZOOM;
    assert.equal(PERSON, 1 / z);
    near(screen(VIEW_W), 320, 'the view is the screen');
    near(screen(VIEW_H), 176);
    near(screen(PACE.walk), 58, 'walking: 58 screen pixels a second');
    near(screen(PACE.swim), 22);
    near(screen(PACE.cop), 47);
    near(screen(HIT.shot - 1), 5, 'a shoulder 5 screen pixels from the middle');
    near(screen(MELEE.fist.ahead), 7, 'a fist lands 7 screen pixels ahead');
    near(screen(MELEE.knife.ahead), 10);
    near(screen(foot()), 3, 'the footprint');
    // A pickup is drawn at the city's scale, 8 city pixels square: reached from its edge by 7 screen pixels.
    near(PICKUP.foot, 4 + 7 / ZOOM, 'a pickup reached from its edge');
    near(screen(touchReach().stand), 6, 'a finger on the player');
    near(screen(NOTICE.car), 150, 'the police notice from as far across the screen as ever');
    // A car is drawn ZOOM times its size, so what is about the car stays in city pixels.
    assert.equal(PICKUP.car, 11);
    assert.equal(touchReach().brake, 16);
    assert.equal(HIT.ahead, 26);
  }
});

test('the bigger the scale, the nearer a person is to their real size beside a car', () => {
  // A person is 12 screen pixels across with their hands, and a sedan 11 city pixels wide: drawn 11 × ZOOM.
  const across = (z) => {
    setZoom(z);
    return 12 / (11 * ZOOM);
  };
  assert.ok(across(1) > 1, 'at 1, a person is wider than a car');
  assert.ok(across(2) > 0.5 && across(2) < 0.6, 'at 2, a little over half as wide');
  assert.ok(Math.abs(across(3) - 0.36) < 0.01, 'at 3, about a third, as in life (0.6 m against 1.8 m)');
});

test('changing the scale in play keeps everyone where they are, at their pace on screen', () => {
  Object.assign(P, { x: 600, y: 400, car: null });
  const walker = mkPed(610, 400, 'civ'),
    cop = mkPed(620, 400, 'cop'),
    scooter = mkPed(630, 400, 'scoot');
  G.peds = [walker, cop, scooter];
  const before = G.peds.map((p) => ({ x: p.x, y: p.y, spd: p.spd }));
  useZoom(3);
  assert.equal(ZOOM, 3);
  G.peds.forEach((p, i) => assert.deepEqual([p.x, p.y], [before[i].x, before[i].y], 'nobody moves'));
  assert.ok(Math.abs(walker.spd - (before[0].spd * 2) / 3) < 1e-9, 'a walker: the same pace on screen');
  assert.ok(Math.abs(cop.spd - PACE.cop) < 1e-9);
  assert.equal(scooter.spd, before[2].spd, "a scooter's speed is the scooter's");
  // The view centres on the player at once.
  assert.ok(Math.abs(G.camX + VIEW_W / 2 - P.x) < 1e-9 && Math.abs(G.camY + VIEW_H / 2 - P.y) < 1e-9);
  assert.match(G.msgTxt, /SCALE 3X/);
});

test('Z goes round the scales, and the choice is remembered', () => {
  nextZoom();
  assert.equal(ZOOM, 3);
  nextZoom();
  assert.equal(ZOOM, 1);
  nextZoom();
  assert.equal(ZOOM, 2);
  useZoom(3);
  assert.equal(store.get('sb64zoom'), '3');
  setZoom(DEFAULT_ZOOM);
  loadZoom();
  assert.equal(ZOOM, 3, 'next time, it starts at 3');
  store.set('sb64zoom', '7');
  setZoom(DEFAULT_ZOOM);
  loadZoom();
  assert.equal(ZOOM, DEFAULT_ZOOM, 'a scale that is not one of the choices is ignored');
  useZoom(9);
  assert.equal(ZOOM, DEFAULT_ZOOM);
});
