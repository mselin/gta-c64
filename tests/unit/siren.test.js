// SPDX-License-Identifier: GPL-2.0-or-later
// The red and blue flashing border goes with the police siren: only while the police are close, in play.
// It used to keep flashing once they had gone, as long as there was any heat, and through the busted screen
// and the return-to-title dialog.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KIND } from '../../js/config.js';
import { genMap } from '../../js/world.js';
import { G, K, P, resetState, sirenFlash } from '../../js/state.js';
import { mkCar } from '../../js/entities.js';
import { updHeat } from '../../js/heat.js';

const DT = 1 / 60;
const AT = { x: 226, y: 304 };
const cruiser = (dx) => Object.assign(mkCar(KIND.police, AT.x + dx, AT.y, 0), { ai: 'cop', driver: true });

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  for (const k in K) delete K[k];
  Object.assign(P, AT);
  G.peds = [];
  G.heat = 3;
  G.heatPts = 60;
});

test('with the police close, the siren goes and the border flashes', () => {
  G.cars = [cruiser(40)];
  for (let i = 0; i < 30; i++) updHeat(DT);
  assert.equal(G.siren, true);
  assert.equal(sirenFlash(), true);
});

test('once the police are gone, the flashing stops, heat or not', () => {
  G.cars = [cruiser(40)];
  for (let i = 0; i < 20; i++) updHeat(DT);
  G.cars = [];
  updHeat(DT);
  assert.equal(G.heat, 3, 'still wanted');
  assert.equal(sirenFlash(), false);
  assert.equal(G.sirenT, 0, 'and the siren starts afresh when they are back');
  for (let i = 0; i < 60; i++) updHeat(DT);
  assert.equal(sirenFlash(), false, 'for good, not stuck half way through a wail');
});

test('back from the title screen with heat and nobody about, nothing flashes', () => {
  // How the friend's game was left: the siren half way through a wail when the player quit to the title.
  Object.assign(G, { sirenT: 0.35, siren: true, screen: 'title' });
  G.cars = [];
  G.screen = 'play';
  updHeat(DT);
  assert.equal(sirenFlash(), false);
});

test('no flashing on the busted screen, while paused, or behind a dialog', () => {
  G.cars = [cruiser(40)];
  for (let i = 0; i < 20; i++) updHeat(DT);
  assert.equal(sirenFlash(), true);
  for (const [flag, label] of [
    ['paused', 'paused'],
    ['quitAsk', 'the return-to-title dialog'],
    ['infoOpen', 'the info page'],
  ]) {
    G[flag] = true;
    assert.equal(sirenFlash(), false, label);
    G[flag] = false;
  }
  G.screen = 'down';
  updHeat(DT);
  assert.equal(sirenFlash(), false, 'busted or flatlined');
});
