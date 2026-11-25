// SPDX-License-Identifier: GPL-2.0-or-later
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FOUNT, KIND, MW, PACE } from '../../js/config.js';
import { genMap, map, wallAt, waterAt } from '../../js/world.js';
import { G, K, P, edge, resetState } from '../../js/state.js';
import { mkCar, mkPed } from '../../js/entities.js';
import { updPlayer } from '../../js/player.js';
import { updPeds } from '../../js/peds.js';

const DT = 1 / 60;
// The canal block east of the first avenues: water from x = 816 to 944, quay on either side.
const MID_CANAL = { x: 880, y: 112 };
const QUAY = { x: 808, y: 112 };

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  for (const k in K) delete K[k];
});

test('water is not a wall for people, but the edge of the map is', () => {
  assert.equal(wallAt(MID_CANAL.x, MID_CANAL.y), false);
  assert.equal(wallAt(-1, 100), true);
  assert.equal(wallAt(100, MW * 16), true);
  assert.equal(wallAt(300, 300), true, 'a building');
});

test('the player can walk off the quay into the canal', () => {
  Object.assign(P, QUAY);
  K.right = true;
  for (let i = 0; i < 60; i++) updPlayer(DT);
  assert.ok(waterAt(P.x, P.y), `in the water at x=${P.x}`);
  assert.equal(P.swim, true);
});

test('swimming is much slower than walking', () => {
  Object.assign(P, MID_CANAL);
  K.left = true;
  const x0 = P.x;
  for (let i = 0; i < 60; i++) updPlayer(DT);
  const swum = x0 - P.x;
  assert.ok(Math.abs(swum - PACE.swim) < 1, `swam ${swum} in a second`);
  assert.ok(PACE.swim < PACE.walk / 2);
});

test('the player can swim back out onto dry land', () => {
  Object.assign(P, MID_CANAL);
  K.left = true;
  for (let i = 0; i < 6 * 60 && waterAt(P.x, P.y); i++) updPlayer(DT);
  assert.ok(!waterAt(P.x, P.y), 'reached the quay');
  updPlayer(DT);
  assert.equal(P.swim, false);
});

test('the player cannot shoot while swimming', () => {
  Object.assign(P, MID_CANAL);
  K.fire = true;
  updPlayer(DT);
  assert.equal(P.ammo, 12);
  assert.equal(G.bullets.length, 0);
});

test('a pedestrian who ends up in the water swims to the bank and stays out', () => {
  const p = mkPed(MID_CANAL.x, MID_CANAL.y, 'civ');
  G.peds.push(p);
  let wet = 0;
  for (let i = 0; i < 15 * 60; i++) {
    updPeds(DT);
    if (waterAt(p.x, p.y)) wet = i;
  }
  assert.ok(!waterAt(p.x, p.y), 'out of the water');
  assert.ok(wet > 60, 'it took a while');
  assert.ok(wet < 10 * 60, `stayed out once ashore (last wet at frame ${wet})`);
});

test('a police officer chasing a swimmer is slowed by the water too', () => {
  Object.assign(P, { x: 930, y: 112 });
  G.heat = 1;
  const cop = mkPed(830, 112, 'cop');
  G.peds.push(cop);
  for (let i = 0; i < 60; i++) updPeds(DT);
  const moved = cop.x - 830;
  assert.ok(moved > 5 && moved < cop.spd * 0.5, `moved ${moved} in a second`);
});

test('getting out in the very frame the car floods leaves the player swimming, without an error', () => {
  // In the canal, wholly in the water: it floods the moment it moves. The player presses to get out at once.
  const c = mkCar(KIND.sedan, 880, 100, 0);
  c.vx = 20;
  G.cars = [c];
  Object.assign(P, { x: c.x, y: c.y, car: c });
  edge.use = true;
  updPlayer(1 / 60);
  edge.use = false;
  assert.equal(c.flooded, true, 'it flooded');
  assert.equal(P.car, null, 'the player is out of it');
  assert.equal(P.swim, true, 'and swimming');
});

/** The middle of a fountain pool (2 by 2 tiles in a plaza), from the map. */
function fountain() {
  for (let ty = 0; ty < MW - 1; ty++)
    for (let tx = 0; tx < MW - 1; tx++)
      if ([0, 1, MW, MW + 1].every((o) => map[ty * MW + tx + o] === FOUNT))
        return { x: tx * 16 + 16, y: ty * 16 + 16 };
  throw new Error('no fountain');
}
const POOLS = { canal: () => MID_CANAL, fountain };

for (const [where, at] of Object.entries(POOLS)) {
  test(`in the ${where} the player swims, and can neither shoot nor fight`, () => {
    const spot = at();
    assert.ok(waterAt(spot.x, spot.y), 'it is water');
    Object.assign(P, spot, { car: null });
    K.fire = true;
    updPlayer(DT);
    assert.equal(P.swim, true, 'swimming');
    assert.equal(P.ammo, 12, 'no shot');
    assert.equal(G.bullets.length, 0);
    // Out of ammo: no punch either.
    P.ammo = 0;
    const q = mkPed(spot.x + 6, spot.y, 'civ');
    G.peds = [q];
    for (let i = 0; i < 30; i++) updPlayer(DT);
    assert.ok(!(q.ko > 0), 'no punch');
  });

  test(`a police officer swimming in the ${where} holds fire; out of the water, they shoot`, () => {
    const spot = at();
    G.heat = 3;
    const cop = Object.assign(mkPed(spot.x, spot.y, 'cop'), { spd: 0, cd: 0 });
    G.peds = [cop];
    // The player on dry land, near enough to be shot at.
    const dry = [60, 80]
      .flatMap((r) => [
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
      ])
      .map(([dx, dy]) => ({ x: spot.x + dx, y: spot.y + dy }))
      .find((p) => !waterAt(p.x, p.y) && !wallAt(p.x, p.y));
    Object.assign(P, dry, { car: null });
    for (let i = 0; i < 120; i++) updPeds(DT);
    assert.equal(G.bullets.length, 0, 'no shots from the water');
    // The same officer on the bank shoots.
    Object.assign(cop, { x: dry.x + 30, y: dry.y, cd: 0 });
    if (waterAt(cop.x, cop.y) || wallAt(cop.x, cop.y)) Object.assign(cop, { x: dry.x, y: dry.y + 30 });
    for (let i = 0; i < 120 && !G.bullets.length; i++) updPeds(DT);
    assert.ok(G.bullets.length > 0, 'shots once out of it');
  });
}
