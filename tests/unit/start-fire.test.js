// SPDX-License-Identifier: GPL-2.0-or-later
// The press of fire that starts the game is not also a shot, however long it is held: the first shot needs fire
// let go of and pressed again. (On a slow machine the press used to last into the first frames of play, and the
// player started with a bullet gone.)
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { G, K, P, edge, resetState } from '../../js/state.js';
import { genMap } from '../../js/world.js';
import { update } from '../../js/game.js';

const DT = 1 / 60;

before(() => genMap());
beforeEach(() => {
  resetState();
  for (const k in K) delete K[k];
  G.screen = 'title';
});

test('starting the game with fire held fires nothing, until fire is let go and pressed again', () => {
  const ammo = P.ammo;
  // The press: fire goes down on the title screen and stays down into the game.
  K.fire = true;
  edge.fire = true;
  update(DT);
  edge.fire = false;
  assert.equal(G.screen, 'play');
  for (let i = 0; i < 30; i++) update(DT);
  assert.equal(P.ammo, ammo, 'no shot while the starting press is held');
  assert.equal(G.bullets.length, 0);
  // Let go, and press again: now it shoots.
  K.fire = false;
  update(DT);
  K.fire = true;
  update(DT);
  assert.equal(P.ammo, ammo - 1, 'a new press shoots');
});
