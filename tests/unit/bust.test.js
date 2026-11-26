// SPDX-License-Identifier: GPL-2.0-or-later
// Arrested at the wheel: boxed in by chasing cars for 2 seconds on end, or an officer at the window for 0.7 seconds
// on end. Each count is its own, and goes back to 0 the moment the player gets free: a close call long ago does
// not leave the player one touch from arrest.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HELI, KIND, VIEW_H, VIEW_W, WPX, setZoom, DEFAULT_ZOOM } from '../../js/config.js';
import { genMap } from '../../js/world.js';
import { G, P, resetState } from '../../js/state.js';
import { mkCar, mkPed } from '../../js/entities.js';
import { BUST, updHeat } from '../../js/heat.js';
import { updPeds } from '../../js/peds.js';
import { updHeli } from '../../js/heli.js';

const DT = 1 / 60;
const AT = { x: 226, y: 304 };

before(() => genMap());
beforeEach(() => {
  setZoom(DEFAULT_ZOOM);
  resetState();
  G.screen = 'play';
  G.peds = [];
  const car = Object.assign(mkCar(KIND.sedan, AT.x, AT.y, 0), { driver: true });
  G.cars = [car];
  P.car = car;
  G.heat = 2;
  G.heatPts = 30;
});
const cop = () => Object.assign(mkCar(KIND.police, AT.x + 20, AT.y, 0), { ai: 'cop', driver: true });
/** `s` seconds of updHeat, with an officer at the window or not. */
function run(s, window = false) {
  for (let t = 0; t < s - 1e-9; t += DT) {
    G.copAtWindow = window;
    updHeat(DT);
  }
}

test('boxed in for most of 2 seconds, then free: the count starts again, and a later touch arrests no one', () => {
  const c = cop();
  G.cars.push(c);
  run(BUST.boxed - 0.1);
  assert.equal(G.screen, 'play');
  G.cars.pop(); // free
  run(1);
  assert.equal(P.car.boxedT, 0);
  G.cars.push(c);
  run(0.2);
  assert.equal(G.screen, 'play', 'not arrested for a moment of being boxed in');
  run(BUST.boxed);
  assert.equal(G.screen, 'down', 'but 2 seconds on end are an arrest');
});

test('an officer at the window: 0.7 seconds on end arrest; a shorter visit leaves nothing behind', () => {
  run(BUST.window - 0.1, true);
  run(0.1, false);
  assert.equal(P.car.windowT, 0);
  run(0.2, true);
  assert.equal(G.screen, 'play');
  run(BUST.window, true);
  assert.equal(G.screen, 'down');
});

test('the two rules do not add up: half of each is no arrest', () => {
  G.cars.push(cop());
  run(BUST.boxed * 0.6);
  G.cars.pop();
  run(BUST.window * 0.6, true);
  assert.equal(G.screen, 'play');
});

test('two officers at the window count once a frame, not twice', () => {
  P.car.vx = P.car.vy = 0;
  G.heat = 3;
  G.peds = [mkPed(AT.x + 8, AT.y, 'cop'), mkPed(AT.x, AT.y + 8, 'cop')];
  for (const q of G.peds) q.cd = 99; // not shooting
  for (let t = 0; t < BUST.window - 0.15; t += DT) {
    updPeds(DT);
    updHeat(DT);
  }
  assert.equal(G.screen, 'play');
  assert.ok(Math.abs(P.car.windowT - (BUST.window - 0.15)) < 0.05, `${P.car.windowT}`);
});

test('at zoom 1 by the edge of the city, the helicopter still comes in from out of sight', () => {
  setZoom(1);
  P.car = null;
  Object.assign(P, { x: 30, y: 30 });
  G.cars = [];
  G.camX = 0; // the view stops at the city's edge: the player is near its corner, not its middle
  G.camY = 0;
  G.heat = 5;
  for (let i = 0; i < 40; i++) {
    G.heli = null;
    updHeli(DT);
    const h = G.heli;
    assert.ok(
      h.x < G.camX - 40 ||
        h.x > G.camX + VIEW_W + 40 ||
        h.y - HELI.alt < G.camY - 40 ||
        h.y - HELI.alt > G.camY + VIEW_H + 40,
      `appeared at ${h.x.toFixed(0)},${h.y.toFixed(0)} in a view of ${VIEW_W} x ${VIEW_H}`,
    );
  }
  assert.ok(WPX > VIEW_W);
  setZoom(DEFAULT_ZOOM);
});

test('a frame of no time does not upset the helicopter', () => {
  P.car = null;
  G.heat = 5;
  updHeli(DT);
  updHeli(0);
  updHeli(DT);
  assert.ok(Number.isFinite(G.heli.x) && Number.isFinite(G.heli.vx));
});
