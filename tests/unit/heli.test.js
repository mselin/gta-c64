// SPDX-License-Identifier: GPL-2.0-or-later
// The police helicopter: at heat 5 it follows the player, cannot be shaken off, never lands or arrests anyone, and
// keeps the heat from cooling while it is overhead. It flies off once the heat is below 5.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HELI, KIND, VIEW_H, VIEW_W } from '../../js/config.js';
import { genMap } from '../../js/world.js';
import { G, P, resetState } from '../../js/state.js';
import { mkCar } from '../../js/entities.js';
import { heliOver, updHeli } from '../../js/heli.js';
import { updHeat } from '../../js/heat.js';
import { down, respawn } from '../../js/player.js';
import { hyp } from '../../js/util.js';

const DT = 1 / 60;
const AT = { x: 226, y: 304 };

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  G.cars = [];
  G.peds = [];
  Object.assign(P, AT);
});
/** Run the helicopter and the heat for `s` seconds; `move` moves the player each step. */
function run(s, move = () => {}) {
  for (let t = 0; t < s; t += DT) {
    move(DT);
    // The view on the player, as the game keeps it.
    G.camX = (P.car || P).x - VIEW_W / 2;
    G.camY = (P.car || P).y - VIEW_H / 2;
    updHeli(DT);
    updHeat(DT);
  }
}
const gap = () => hyp(G.heli.x - (P.car || P).x, G.heli.y - (P.car || P).y);

test('it comes at heat 5, not before, from out of sight', () => {
  G.heat = 4;
  run(1);
  assert.equal(G.heli, null, 'not at heat 4');
  G.heat = 5;
  G.heatPts = 200;
  updHeli(DT);
  assert.ok(G.heli, 'at heat 5');
  assert.ok(gap() > HELI.from - 5, 'from out of sight');
  run(4);
  assert.ok(heliOver(), 'and in a few seconds it is over the player');
  assert.match(G.msgTxt, /POLICE HELICOPTER/);
});

test('flat out in the fastest car, in a straight line, the player cannot shake it off', () => {
  const car = Object.assign(mkCar(KIND.sports, AT.x, AT.y, 0), { driver: true });
  G.cars.push(car);
  P.car = car;
  G.heat = 5;
  G.heatPts = 200;
  run(4);
  // A sports car pulling away as hard as it can, up to its top speed, through buildings and all, as the
  // helicopter flies over them.
  let worst = 0,
    v = 0;
  run(20, (dt) => {
    v = Math.min(KIND.sports.max, v + KIND.sports.acc * dt);
    car.x += v * dt;
    if (G.heli) worst = Math.max(worst, gap());
  });
  assert.ok(worst < HELI.light, `never more than ${worst.toFixed(1)} pixels behind`);
  assert.equal(G.heat, 5, 'and the heat stays at 5');
});

test('it never lands and never arrests: it only lights the player up', () => {
  G.heat = 5;
  G.heatPts = 200;
  run(30);
  assert.equal(G.screen, 'play');
  assert.equal(P.hp, 100);
  assert.ok(heliOver());
  assert.equal(G.heat, 5, 'with no police on the ground near, the heat would have cooled in 9 seconds');
});

test('with the heat below 5 it flies off and is gone; going down sends it home at once', () => {
  G.heat = 5;
  G.heatPts = 200;
  run(4);
  G.heat = 0; // the paint shop, say
  G.heatPts = 0;
  run(0.5);
  assert.ok(G.heli && !heliOver(), 'leaving: it lights nobody up');
  run(6);
  assert.equal(G.heli, null, 'gone');
  G.heat = 5;
  G.heatPts = 200;
  run(2);
  assert.ok(G.heli);
  G.cash = 100;
  down('busted');
  respawn();
  assert.equal(G.heli, null, 'busted: gone with the rest of the police');
});
