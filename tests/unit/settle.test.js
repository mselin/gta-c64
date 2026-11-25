// SPDX-License-Identifier: GPL-2.0-or-later
// Settling on a straight line: a car someone is driving, with the wheel straight, within HANDLING.snap of one of
// the eight ways (the axes and the diagonals), turns onto it and keeps exactly to it, so it does not drift across
// a street for ever. Turning is as smooth as before, and nothing else is touched.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HANDLING, KIND, MW, ROAD } from '../../js/config.js';
import { genMap, map } from '../../js/world.js';
import { G, K, P, resetState } from '../../js/state.js';
import { mkCar } from '../../js/entities.js';
import { carPhys } from '../../js/cars.js';
import { updPlayer } from '../../js/player.js';

const DT = 1 / 60;
const MID = (MW * 16) / 2;
const EIGHTH = Math.PI / 4;

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  map.fill(ROAD);
  for (const k in K) delete K[k];
  G.peds = [];
});
/** The player at the wheel of a sedan pointing `a`, going 100 that way. */
function drive(a) {
  const c = mkCar(KIND.sedan, MID, MID, a);
  c.vx = Math.cos(a) * 100;
  c.vy = Math.sin(a) * 100;
  G.cars = [c];
  Object.assign(P, { x: c.x, y: c.y, car: c });
  return c;
}
const run = (s) => {
  for (let i = 0; i < s * 60; i++) updPlayer(DT);
};
/** How far the way the car moves is from `a`. */
const drift = (c, a) => Math.abs(Math.atan2(c.vy, c.vx) - a);

for (const [name, at] of [
  ['the x-axis', 0],
  ['the y-axis', Math.PI / 2],
  ['a diagonal', EIGHTH],
  ['the x-axis going west', Math.PI],
]) {
  for (const off of [0.08, -0.15]) {
    test(`a car let go of ${off > 0 ? 'just above' : 'below'} ${name} settles onto it and drives along it`, () => {
      const c = drive(at + off);
      K.up = true;
      run(1);
      assert.ok(Math.abs(c.a - at) < 1e-9, `pointing ${c.a.toFixed(4)}, not ${at.toFixed(4)}`);
      assert.ok(drift(c, at) < 1e-3, `moving that way (${drift(c, at).toFixed(5)} off)`);
      const y = c.y,
        x = c.x;
      run(1);
      // Along the axis it stays on its line exactly.
      if (at === 0 || at === Math.PI) assert.ok(Math.abs(c.y - y) < 1e-6, 'it keeps to its line');
      if (at === Math.PI / 2) assert.ok(Math.abs(c.x - x) < 1e-6, 'it keeps to its line');
    });
  }
}

test('a car pointing further off any of the eight ways keeps the way it points', () => {
  const a = EIGHTH / 2, // half way between the x-axis and the diagonal
    c = drive(a);
  K.up = true;
  run(1);
  assert.ok(Math.abs(c.a - a) < 1e-9, `still ${a.toFixed(3)}`);
  const b = HANDLING.snap + 0.03,
    d = drive(b);
  run(1);
  assert.ok(Math.abs(d.a - b) < 1e-9, 'just outside the snap, too');
});

test('steering turns smoothly through the axes, without catching on them', () => {
  const c = drive(-0.6);
  K.up = true;
  K.right = true;
  const seen = [];
  for (let i = 0; i < 40; i++) {
    updPlayer(DT);
    seen.push(c.a);
  }
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] > seen[i - 1], 'turning all the way');
  assert.ok(seen.at(-1) > 0.3, `through the x-axis and on (${seen.at(-1).toFixed(2)})`);
});

test('a car nobody is driving is left as it is', () => {
  const c = mkCar(KIND.sedan, MID, MID, 0.1);
  c.vx = Math.cos(0.1) * 100;
  c.vy = Math.sin(0.1) * 100;
  G.cars = [c];
  for (let i = 0; i < 60; i++) carPhys(c, 0, 0, DT);
  assert.ok(Math.abs(c.a - 0.1) < 1e-9, 'a car rolling on its own keeps its angle');
});

test('a police car chasing settles too', () => {
  const c = mkCar(KIND.police, MID, MID, Math.PI / 2 + 0.1);
  c.ai = 'cop';
  c.vx = Math.cos(c.a) * 100;
  c.vy = Math.sin(c.a) * 100;
  for (let i = 0; i < 60; i++) carPhys(c, 1, 0, DT);
  assert.ok(Math.abs(c.a - Math.PI / 2) < 1e-9);
});

test('on the handbrake, or spinning from a knock, it does not', () => {
  const c = drive(0.1);
  c.w = 1;
  carPhys(c, 0, 0, DT);
  assert.ok(Math.abs(c.a - 0.1) > 1e-3 && c.a > 0.1, 'the spin turns it, not the settling');
  const d = drive(0.1);
  carPhys(d, 0, 0, DT, true);
  assert.equal(d.a, 0.1, 'the handbrake: left as it is');
});
