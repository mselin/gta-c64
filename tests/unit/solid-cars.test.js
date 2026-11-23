// SPDX-License-Identifier: GPL-2.0-or-later
// Cars are solid for anyone on foot, stopped or moving: people and scooter riders stop short of a car in their
// way and step round it, the police on foot go round, and the player is stopped at its side. Nobody walks or
// rides through a parked car. (They used to: only walls stopped them.)
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KIND, MW, WALK } from '../../js/config.js';
import { foot, genMap, map } from '../../js/world.js';
import { G, K, P, carBodyAt, edge, resetState } from '../../js/state.js';
import { mkCar, mkPed } from '../../js/entities.js';
import { ROUND_CAR, updPeds } from '../../js/peds.js';
import { updPlayer } from '../../js/player.js';

const DT = 1 / 60;
const MID = (MW * 16) / 2;

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  map.fill(WALK); // open pavement everywhere: only the car is in the way
  for (const k in K) delete K[k];
  Object.assign(P, { x: MID, y: MID - 300, car: null });
  G.peds = [];
});

/** A car parked across the way east, its middle at (MID, MID), lying north to south. */
const parked = () => {
  const c = mkCar(KIND.sedan, MID, MID, Math.PI / 2);
  G.cars = [c];
  return c;
};
/** Inside the car's body, with less than a footprint to spare: what must never happen. */
const inside = (p) => !!carBodyAt(p.x, p.y, foot() * 0.9);
/** Someone walking east at the car, `y` off its middle, a little to the west of it. */
const walker = (type, y = 0) => Object.assign(mkPed(MID - 30, MID + y, type), { dx: 1, dy: 0, t: 1e9 });

for (const type of ['civ', 'scoot']) {
  test(`a ${type === 'civ' ? 'passer-by' : 'scooter rider'} stops short of a parked car, steps round it, and carries on`, () => {
    const c = parked(),
      p = walker(type);
    G.peds = [p];
    let stopped = 0,
      stepped = false;
    for (let i = 0; i < 30 * 60 && p.x < c.x + 20; i++) {
      const x = p.x;
      updPeds(DT);
      assert.equal(
        inside(p),
        false,
        `never inside the car (step ${i}, at ${p.x.toFixed(1)}, ${p.y.toFixed(1)})`,
      );
      if (p.x === x && !p.round) stopped += DT;
      if (p.round) stepped = true;
    }
    assert.ok(stopped >= ROUND_CAR.wait * 0.9, `stopped near it first (${stopped.toFixed(2)} s)`);
    assert.ok(stepped, 'then stepped round it');
    assert.ok(
      p.x > c.x + 20,
      `and is past it, going the same way (x ${(p.x - c.x).toFixed(1)} from the car)`,
    );
    assert.deepEqual([p.dx, p.dy], [1, 0]);
  });
}

test('someone heading past the end of a car steps round the near end', () => {
  const c = parked(),
    p = walker('civ', 6); // the car's middle is 6 above their line: its bottom end is in the way
  G.peds = [p];
  for (let i = 0; i < 30 * 60 && p.x < c.x + 20; i++) {
    updPeds(DT);
    assert.equal(inside(p), false);
  }
  assert.ok(p.x > c.x + 20);
  assert.ok(p.y > MID + 6, 'round the bottom end, the nearer one, not all the way round the top');
});

test('a police officer on foot chasing the player goes round a parked car, not through it', () => {
  const c = parked();
  G.heat = 2;
  const cop = Object.assign(mkPed(MID - 30, MID, 'cop'), { cd: 99 });
  G.peds = [cop];
  Object.assign(P, { x: MID + 40, y: MID }); // the player on the far side of the car
  for (let i = 0; i < 20 * 60 && G.screen === 'play'; i++) {
    updPeds(DT);
    assert.equal(inside(cop), false, `never inside the car (step ${i})`);
  }
  assert.equal(G.screen, 'down', 'and gets to the player in the end: busted');
  assert.ok(c.x === MID);
});

test('the player on foot is stopped at a parked car, and can get in from there', () => {
  const c = parked();
  Object.assign(P, { x: MID - 30, y: MID, a: 0 });
  K.right = true;
  for (let i = 0; i < 4 * 60; i++) {
    updPlayer(DT);
    assert.equal(inside(P), false, 'never inside the car');
  }
  assert.ok(P.x < c.x && P.x > c.x - 12, `stopped at its side (${(P.x - c.x).toFixed(1)})`);
  K.right = false;
  edge.use = true;
  updPlayer(DT);
  delete edge.use;
  assert.equal(P.car, c, 'in');
});

test('someone a car has stopped on top of can walk out from under it', () => {
  const c = parked(),
    p = Object.assign(mkPed(MID, MID + 2, 'civ'), { dx: 1, dy: 0, t: 1e9 });
  G.peds = [p];
  assert.equal(inside(p), true);
  for (let i = 0; i < 10 * 60 && inside(p); i++) updPeds(DT);
  assert.equal(inside(p), false, 'out');
  // The player too.
  Object.assign(P, { x: MID, y: MID - 2 });
  K.left = true;
  for (let i = 0; i < 4 * 60 && inside(P); i++) updPlayer(DT);
  assert.equal(inside(P), false);
  assert.ok(c.x === MID);
});
