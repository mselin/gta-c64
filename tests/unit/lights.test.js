// SPDX-License-Identifier: GPL-2.0-or-later
// A police car's red and blue light bar: on a chasing car while there is any heat, and from heat LIGHTS.heat on
// every police car with an officer at the wheel, patrols too. Not on a wreck, an empty car or the player's car.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KIND, LIGHTS } from '../../js/config.js';
import { G, P, resetState } from '../../js/state.js';
import { mkCar } from '../../js/entities.js';
import { copLights } from '../../js/cars.js';

beforeEach(() => resetState());
const cop = (o = {}) => Object.assign(mkCar(KIND.police, 100, 100, 0), { driver: true }, o);

test('a chasing police car flashes with any heat, and not with none', () => {
  G.heat = 0;
  assert.equal(copLights(cop({ ai: 'cop' })), false);
  G.heat = 1;
  assert.equal(copLights(cop({ ai: 'cop' })), true);
});

test('a patrol flashes only from heat LIGHTS.heat', () => {
  G.heat = LIGHTS.heat - 1;
  assert.equal(copLights(cop()), false);
  G.heat = LIGHTS.heat;
  assert.equal(copLights(cop()), true);
});

test("no lights on a wreck, an empty police car, the player's car, or another kind of car", () => {
  G.heat = 5;
  assert.equal(copLights(cop({ dead: true, ai: 'cop' })), false);
  assert.equal(copLights(cop({ driver: false })), false);
  const mine = cop({ ai: 'cop' });
  P.car = mine;
  assert.equal(copLights(mine), false);
  assert.equal(copLights(Object.assign(mkCar(KIND.sedan, 0, 0, 0), { driver: true, ai: 'cop' })), false);
});
