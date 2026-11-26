// SPDX-License-Identifier: GPL-2.0-or-later
// The police react to the player driving on the pavement where they can see it: a crime, with a line from them,
// at most once every few seconds. Out of their sight, on the road, or barely moving, it is not.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KIND, MW, NOTICE, ROAD, SIDEWALK, SIDEWALK_SAYS, WALK } from '../../js/config.js';
import { genMap, map } from '../../js/world.js';
import { G, P, resetState } from '../../js/state.js';
import { mkCar, mkPed } from '../../js/entities.js';
import { resetHeat, updHeat } from '../../js/heat.js';

const DT = 1 / 60;
const MID = (MW * 16) / 2 + 8;

before(() => genMap());
beforeEach(() => {
  resetState();
  resetHeat();
  map.fill(WALK);
  G.screen = 'play';
  G.peds = [];
  G.cams = [];
  const car = Object.assign(mkCar(KIND.sedan, MID, MID, 0), { driver: true, vx: 80, vy: 0 });
  G.cars = [car];
  P.car = car;
});
/** A police car on patrol in ordinary traffic, `d` pixels east of the player. */
function patrol(d) {
  const c = Object.assign(mkCar(KIND.police, MID + d, MID, 0), { ai: 'traffic', driver: true });
  G.cars.push(c);
  return c;
}
function run(s) {
  for (let t = 0; t < s; t += DT) {
    G.clock += DT;
    updHeat(DT);
  }
}

test('driving on the pavement in front of a patrol car is a crime, and the police say so', () => {
  patrol(NOTICE.patrol - 5);
  run(DT);
  assert.equal(G.heatPts, SIDEWALK.crime);
  assert.ok(SIDEWALK_SAYS.includes(G.msgTxt), G.msgTxt);
});

test('an officer on foot sees it too, and a chasing car', () => {
  G.peds = [mkPed(MID + NOTICE.foot - 5, MID, 'cop')];
  run(DT);
  assert.equal(G.heatPts, SIDEWALK.crime);
  G.peds = [];
  G.cars.push(Object.assign(mkCar(KIND.police, MID + NOTICE.car - 5, MID, 0), { ai: 'cop', driver: true }));
  run(SIDEWALK.again + 0.1);
  assert.ok(G.heatPts >= 2 * SIDEWALK.crime);
});

test('at most once every few seconds, however long it goes on', () => {
  patrol(40);
  run(SIDEWALK.again * 3 - 0.2);
  assert.equal(G.heatPts, 3 * SIDEWALK.crime);
});

test('not out of their sight, not on the road, not barely moving, not on foot', () => {
  patrol(NOTICE.patrol + 5);
  run(1);
  assert.equal(G.heatPts, 0, 'too far off');
  G.cars.pop();
  patrol(40);
  map.fill(ROAD);
  run(1);
  assert.equal(G.heatPts, 0, 'on the road');
  map.fill(WALK);
  P.car.vx = SIDEWALK.speed - 1;
  run(1);
  assert.equal(G.heatPts, 0, 'crawling');
  P.car = null;
  Object.assign(P, { x: MID, y: MID });
  run(1);
  assert.equal(G.heatPts, 0, 'walking on the pavement is what it is for');
});

test('a rise in the heat still gets announced over the police line', () => {
  patrol(40);
  G.heatPts = 7; // one short of heat 1
  run(DT);
  assert.equal(G.heat, 1);
  assert.match(G.msgTxt, /STERN LETTER/);
});
