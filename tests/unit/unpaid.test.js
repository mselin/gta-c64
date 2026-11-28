// SPDX-License-Identifier: GPL-2.0-or-later
// Wasted with less than the hospital's bill, by anyone: the hospital hands the player to the police, and they are
// busted. With no cash at all, the game is over: the jail ending.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PENALTY } from '../../js/config.js';
import { genMap, COPS, HOSP } from '../../js/world.js';
import { G, P, resetState } from '../../js/state.js';
import { down, hurt, lastDown, respawn } from '../../js/player.js';

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  G.cars = [];
  G.peds = [];
  Object.assign(P, { x: 226, y: 304, ammo: 9, knife: true });
});

test('enough for the bill: the hospital, billed in full', () => {
  G.cash = PENALTY.bill;
  down('dead');
  respawn();
  assert.deepEqual([P.x, P.y, G.cash], [HOSP.x, HOSP.y, 0]);
  assert.match(G.msgTxt, /^ST\. INVOICE HOSPITAL: AMBULANCE RIDE -\$500/);
  assert.ok(P.knife && P.ammo === 9, 'no police about: armed still');
});

test('short of the bill: busted, at the police station, fined, disarmed', () => {
  G.cash = PENALTY.bill - 1;
  hurt(999, 'A PEDESTRIAN. IN THIS ECONOMY?');
  assert.equal(G.screen, 'down');
  assert.equal(lastDown(), 'dead', 'the banner, and the presence, still say flatlined');
  assert.ok(!P.knife && P.ammo === 0, 'the police take the weapons');
  respawn();
  assert.equal(G.screen, 'play');
  assert.deepEqual([P.x, P.y], [COPS.x, COPS.y]);
  assert.equal(G.cash, 499 - Math.floor(499 * PENALTY.fine));
  assert.match(G.msgTxt, /^CAN'T PAY ST\. INVOICE\? THE POLICE CAN\. CIVIL ASSET FORFEITURE: -\$99\./);
});

test('no cash at all: busted and broke, the game is over', () => {
  G.cash = 0;
  down('dead', null, true);
  respawn();
  assert.equal(G.screen, 'over');
});

test('the next time, with the bill to hand, it is the hospital again', () => {
  G.cash = 0;
  down('dead');
  G.cash = 1000;
  down('dead');
  respawn();
  assert.deepEqual([P.x, P.y], [HOSP.x, HOSP.y]);
});
