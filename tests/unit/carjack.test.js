// SPDX-License-Identifier: GPL-2.0-or-later
// Taking a car from its driver throws them out at the door, onto the ground: they lie there as anyone knocked
// down does, then get up. A police car's driver is a police officer.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KIND, KO, MW, WALK } from '../../js/config.js';
import { genMap, map } from '../../js/world.js';
import { G, K, P, carBodyAt, edge, resetState } from '../../js/state.js';
import { mkCar } from '../../js/entities.js';
import { updPlayer } from '../../js/player.js';
import { updPeds } from '../../js/peds.js';

const DT = 1 / 60;
const MID = (MW * 16) / 2;

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  map.fill(WALK);
  for (const k in K) delete K[k];
  G.peds = [];
  G.cams = [];
});
/** A car with someone at the wheel, stopped, and the player on foot beside it. */
function withDriver(kind) {
  const c = mkCar(kind, MID, MID, 0);
  c.driver = true;
  c.ai = 'traffic';
  G.cars = [c];
  Object.assign(P, { x: MID, y: MID + 12, car: null });
  return c;
}
const takeIt = () => {
  edge.use = true;
  updPlayer(DT);
  edge.use = false;
};

for (const [kind, type, name] of [
  [KIND.sedan, 'civ', 'a passer-by'],
  [KIND.police, 'cop', 'a police officer'],
]) {
  test(`taking ${kind === KIND.police ? 'a police car' : 'a car'} throws its driver, ${name}, to the ground for a while`, () => {
    const c = withDriver(kind);
    takeIt();
    assert.equal(P.car, c, 'the player has the car');
    assert.equal(G.peds.length, 1, 'its driver is out');
    const q = G.peds[0];
    assert.equal(q.type, type);
    assert.equal(q.ko, KO.t, 'on the ground, as if knocked down');
    assert.ok(Math.hypot(q.x - c.x, q.y - c.y) < 20, 'beside the car');
    assert.equal(!!carBodyAt(q.x, q.y, 0), false, 'not inside it');
    const away = (q.x - c.x) * q.dx + (q.y - c.y) * q.dy;
    assert.ok(away > 0, 'lying facing away from the car');
    // Still down most of the time, then up.
    for (let i = 0; i < (KO.t - 0.2) * 60; i++) updPeds(DT);
    assert.ok(q.ko > 0, 'still down');
    for (let i = 0; i < 0.4 * 60; i++) updPeds(DT);
    assert.ok(!(q.ko > 0), 'back on their feet');
    if (type === 'civ') assert.ok(q.flee > 0, 'and running from the player');
  });
}

test('a car with nobody in it gives up nobody', () => {
  const c = withDriver(KIND.sedan);
  c.driver = false;
  c.ai = null;
  c.parked = true;
  takeIt();
  assert.equal(P.car, c);
  assert.equal(G.peds.length, 0);
});
