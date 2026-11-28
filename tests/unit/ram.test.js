// SPDX-License-Identifier: GPL-2.0-or-later
// From heat 3, chasing police cars ram the player's car (issue #119): aimed where it is going, throttle down into
// it, and when pressed against it they drop back for a run-up and come again. A ram by the police is no crime of
// the player's, and the player on foot is not run down.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BLK, KIND, RAM } from '../../js/config.js';
import { genMap } from '../../js/world.js';
import { G, P, resetState } from '../../js/state.js';
import { mkCar } from '../../js/entities.js';
import { updCars } from '../../js/cars.js';

const DT = 1 / 60;
// A long straight road running east.
const AT = { x: 2 * BLK + 140, y: 2 * BLK + 16 };

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  G.peds = [];
  G.cars = [];
  Object.assign(P, AT, { hp: 100 });
});
/** The player's sedan and a chasing police car `back` pixels behind it, both facing east. */
function scene(back = 100) {
  const mine = Object.assign(mkCar(KIND.sedan, AT.x, AT.y, 0), { driver: true });
  const cop = Object.assign(mkCar(KIND.police, AT.x - back, AT.y, 0), { ai: 'cop', driver: true });
  G.cars.push(mine, cop);
  P.car = mine;
  return { mine, cop };
}
/**
 * `s` seconds of the cars, the player driving straight on east at `go` pixels a second (the player's own car is
 * moved by js/player.js, not updCars). The knocks that hurt the player's car, and whether the police backed off.
 */
function run(s, mine, cop, go = 0) {
  const hits = [];
  let backed = false;
  for (let t = 0; t < s; t += DT) {
    if (go) Object.assign(mine, { vx: go, vy: 0, a: 0, x: mine.x + go * DT, y: AT.y });
    const hp = mine.hp;
    updCars(DT);
    if (hp - mine.hp > 0.5) hits.push(hp - mine.hp);
    if (cop.ramBack > 0) backed = true;
  }
  return { hits, backed };
}

test('below heat 3 a chasing car follows the player, and does not set out to hit them', () => {
  G.heat = RAM.heat - 1;
  G.heatPts = 60;
  const { mine, cop } = scene();
  const r = run(6, mine, cop, 60);
  assert.ok(r.hits.length <= 1 && r.hits.every((h) => h < 5), `knocks ${r.hits.map((h) => h.toFixed(1))}`);
  assert.equal(r.backed, false);
});

test('from heat 3 it rams the moving car again and again, and the rams are no crime of the player', () => {
  G.heat = RAM.heat;
  G.heatPts = 100;
  const { mine, cop } = scene();
  const r = run(6, mine, cop, 60);
  const hard = r.hits.filter((h) => h > 10);
  assert.ok(hard.length >= 2, `hard knocks ${r.hits.map((h) => h.toFixed(1))}`);
  assert.ok(r.backed, 'dropped back between them for a run-up');
  assert.equal(G.heatPts, 100, 'no heat for being rammed');
});

test('a car standing still is rammed hard, and then the officers get out to make the arrest', () => {
  G.heat = RAM.heat;
  G.heatPts = 100;
  const { mine, cop } = scene();
  let hit = 0;
  for (let t = 0; t < 3; t += DT) {
    Object.assign(mine, { vx: 0, vy: 0, x: AT.x, y: AT.y });
    const hp = mine.hp;
    updCars(DT);
    hit = Math.max(hit, hp - mine.hp);
  }
  assert.ok(hit > 15, `the knock took ${hit.toFixed(1)}`);
  assert.ok(G.peds.some((q) => q.type === 'cop'), 'officers on foot');
});

test('the player on foot is not run down', () => {
  G.heat = 5;
  G.heatPts = 200;
  const cop = Object.assign(mkCar(KIND.police, AT.x - 100, AT.y, 0), { ai: 'cop', driver: true });
  G.cars.push(cop);
  for (let t = 0; t < 3; t += DT) updCars(DT);
  assert.equal(P.hp, 100);
});
