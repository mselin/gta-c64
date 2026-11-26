// SPDX-License-Identifier: GPL-2.0-or-later
// The difficulty, chosen on the title screen with D: classic to begin with, or modern. Only on modern does the city
// have cursed driver assistance (lane assist, emergency braking, anti-theft and its car alarm) and the GAGGLE cameras.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, KIND } from '../../js/config.js';
import { G, K, P, edge, resetState } from '../../js/state.js';
import { genMap } from '../../js/world.js';
import { initWorld, update } from '../../js/game.js';
import { fitAssists } from '../../js/adas.js';
import { mkCar } from '../../js/entities.js';
import { HELP } from '../../js/help.js';

const DT = 1 / 60;
const fitted = (c) => !!(c.lane || c.aeb || c.theft);
const anyFitted = () => G.cars.some(fitted);
/** Fire on the title screen: play starts, or goes on. */
function start() {
  G.screen = 'title';
  edge.fire = true;
  update(DT);
  edge.fire = false;
  assert.equal(G.screen, 'play');
}

before(() => genMap());
beforeEach(() => {
  G.difficulty = 'classic';
  resetState();
  for (const k in K) delete K[k];
  initWorld();
});

test('classic to begin with: no driver assistance, no alarms, no cameras', () => {
  assert.equal(DIFFICULTIES[0], 'classic');
  start();
  assert.equal(anyFitted(), false, `${G.cars.length} cars, none with assistance`);
  assert.equal(G.cams.length, 0);
  // Nor on a car that turns up later, police included.
  for (let i = 0; i < 50; i++) assert.equal(fitted(fitAssists(mkCar(KIND.police, 0, 0, 0))), false);
  for (let i = 0; i < 50; i++) assert.equal(fitted(fitAssists(mkCar(KIND.sports, 0, 0, 0))), false);
});

test('modern, chosen at the title screen: the city has them when play starts', () => {
  G.difficulty = 'modern';
  start();
  assert.ok(anyFitted(), 'some cars have assistance');
  assert.equal(G.cams.length, 17, 'the GAGGLE cameras');
  assert.ok(fitted(fitAssists(mkCar(KIND.police, 0, 0, 0))), 'every police car has anti-theft');
  // The car beside the hospital stays without, as it always has.
  assert.ok(G.cars.some((c) => c.bare && !fitted(c)));
});

test('back to classic: they go; the player keeps nothing they had', () => {
  G.difficulty = 'modern';
  start();
  const car = G.cars.find(fitted);
  car.driver = true;
  P.car = car;
  G.difficulty = 'classic';
  start();
  assert.equal(anyFitted(), false);
  assert.equal(G.cams.length, 0);
  assert.ok(!(car.alarm > 0));
});

test('going on with the difficulty unchanged leaves the city as it is', () => {
  G.difficulty = 'modern';
  start();
  const before = G.cars.map((c) => [c.lane, c.aeb, c.theft]);
  const cams = G.cams;
  start();
  assert.deepEqual(
    G.cars.slice(0, before.length).map((c) => [c.lane, c.aeb, c.theft]),
    before,
  );
  assert.equal(G.cams, cams);
});

test('the title says which, in at most 40 characters, and a touch screen is told to tap, not to press a key', () => {
  for (const d of DIFFICULTIES) {
    for (const h of [HELP.keys, HELP.touch]) assert.ok(h.difficulty(d).length <= 40, h.difficulty(d));
    assert.match(HELP.keys.difficulty(d), new RegExp(`DIFFICULTY: ${d.toUpperCase()} - PRESS D`));
    assert.match(HELP.touch.difficulty(d), /TAP HERE/);
    assert.doesNotMatch(HELP.touch.difficulty(d), /PRESS/);
  }
});
