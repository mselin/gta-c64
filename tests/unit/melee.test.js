// SPDX-License-Identifier: GPL-2.0-or-later
// Out of ammo, the player fights hand to hand: a punch knocks someone down, a knife kills (issue #11).
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AMMO_MAX, KNIFE, KO, MELEE, SW } from '../../js/config.js';
import { genMap } from '../../js/world.js';
import { G, K, P, resetState, weapon, weaponLabel } from '../../js/state.js';
import { mkPed } from '../../js/entities.js';
import { DOWN, FRAME, PUNCH, STAB, pixels, poseOf } from '../../js/figures.js';
import { down, updPlayer } from '../../js/player.js';
import { killPed, updPeds } from '../../js/peds.js';
import { updPickups } from '../../js/items.js';
import { placePickup } from '../../js/spawner.js';
import { updHeat } from '../../js/heat.js';

const DT = 1 / 60;
// Open pavement beside the hospital's west wall, the player facing east along it.
const AT = { x: 226, y: 304 };
const still = (dx, type = 'civ') => Object.assign(mkPed(AT.x + dx, AT.y, type), { spd: 0, t: 99 });

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  G.cars = [];
  G.pickups = [];
  for (const k in K) delete K[k];
  Object.assign(P, AT, { a: 0, ammo: 0, cd: 0 });
});
/** One press of fire. */
function strike() {
  K.fire = true;
  updPlayer(DT);
  K.fire = false;
}

test('what fire does: the gun while there is ammo, then the knife, then fists', () => {
  P.ammo = 3;
  P.knife = true;
  assert.equal(weapon(), 'gun');
  P.ammo = 0;
  assert.equal(weapon(), 'knife');
  P.knife = false;
  assert.equal(weapon(), 'fist');
  // With ammo, fire still shoots, knife or not.
  Object.assign(P, { ammo: 1, knife: true });
  const q = still(12);
  G.peds = [q];
  strike();
  assert.equal(G.bullets.length, 1);
  assert.equal(P.ammo, 0);
});

test('a punch knocks someone down; they stay down, then get up and run from the player', () => {
  const q = still(MELEE.fist.ahead + 3);
  G.peds = [q];
  strike();
  assert.equal(poseOf(P), PUNCH);
  assert.equal(P.cd, MELEE.fist.cd);
  assert.ok(G.peds.includes(q), 'still alive');
  assert.equal(q.ko, KO.t);
  assert.equal(poseOf(q), DOWN);
  assert.equal(G.heatPts, KO.crime, 'half the heat of a kill');
  // Down for KO.t seconds, not moving.
  const x0 = q.x;
  for (let t = DT; t < KO.t - 0.1; t += DT) updPeds(DT);
  assert.equal(poseOf(q), DOWN);
  assert.equal(q.x, x0);
  for (let i = 0; i < 12; i++) updPeds(DT);
  assert.notEqual(poseOf(q), DOWN, 'back up');
  assert.ok(q.flee > 0 && q.fx === P.x && q.fy === P.y, 'and running from the player');
  for (let i = 0; i < 30; i++) updPeds(DT);
  assert.ok(q.x > x0, 'away from them');
});

test('a punch reaches only so far, and passes over someone already down', () => {
  const far = still(MELEE.fist.ahead + MELEE.fist.r + 1);
  G.peds = [far];
  strike();
  assert.equal(far.ko, 0, 'out of reach');
  const first = still(6),
    second = still(10);
  G.peds = [first, second];
  first.ko = 2;
  P.cd = 0;
  strike();
  assert.equal(first.ko, 2, 'not hit again');
  assert.equal(second.ko, KO.t, 'the one behind is');
});

test('a knife kills, from farther than a fist reaches', () => {
  P.knife = true;
  const q = still(MELEE.knife.ahead + MELEE.knife.r - 1);
  assert.ok(MELEE.knife.ahead + MELEE.knife.r - 1 > MELEE.fist.ahead + MELEE.fist.r, 'beyond a fist');
  G.peds = [q];
  strike();
  assert.equal(poseOf(P), STAB);
  assert.equal(P.cd, MELEE.knife.cd);
  assert.ok(MELEE.knife.cd < MELEE.fist.cd, 'and quicker');
  assert.equal(G.peds.includes(q), false);
  // Someone already down is finished off.
  const downed = Object.assign(still(8), { ko: 2 });
  G.peds = [downed];
  P.cd = 0;
  strike();
  assert.equal(G.peds.length, 0);
});

test('the arm goes out with a white blade for a stab; someone down lies flat', () => {
  const blade = pixels(P, STAB, 0);
  assert.ok(
    !pixels(P, PUNCH, 0).includes(1) && blade.includes(1) && !blade.includes(11),
    'a white blade, not the gun',
  );
  // Flat on their back they are longer than they are standing: legs out behind, the head in front.
  const q = mkPed(0, 0, 'civ'),
    xs = (px) => [...px].flatMap((c, i) => (c >= 0 ? [i % FRAME] : []));
  const len = (px) => Math.max(...xs(px)) - Math.min(...xs(px)) + 1;
  assert.ok(len(pixels(q, DOWN, 0)) >= 14, `lying is ${len(pixels(q, DOWN, 0))} px long`);
});

test('a police officer knocked down cannot arrest, shoot or notice anyone until they get up', () => {
  G.heat = 3;
  G.heatPts = 60;
  const cop = Object.assign(mkPed(AT.x + 5, AT.y, 'cop'), { cd: 0 });
  G.peds = [cop];
  strike();
  assert.equal(cop.ko, KO.t);
  assert.ok(G.heatPts >= 60 + KO.copCrime - 1, 'punching the police is heat');
  for (let i = 0; i < 60; i++) updPeds(DT);
  assert.equal(G.screen, 'play', 'not busted while they are down');
  assert.equal(G.bullets.length, 0, 'and not shot at');
  // Lying there they do not notice the player either: the heat keeps cooling with them right beside.
  G.heatCool = 5;
  updHeat(DT);
  assert.ok(G.heatCool > 5, 'not seen');
  cop.ko = 0;
  updHeat(DT);
  assert.equal(G.heatCool, 0, 'seen once up');
  cop.ko = KO.t - 1;
  // Once up, they carry on.
  G.heat = 3;
  for (let t = 0; t < KO.t; t += DT) updPeds(DT);
  assert.equal(poseOf(cop) === DOWN, false);
  assert.equal(G.screen, 'down', 'and the arrest goes ahead');
});

test('picking up a knife arms the player; a spare one is pawned; going down loses it', () => {
  G.pickups = [{ x: P.x, y: P.y, type: 'knife', temp: 20, t: 0 }];
  updPickups(DT);
  assert.equal(P.knife, true);
  assert.match(G.msgTxt, /KNIFE/);
  const cash = G.cash;
  G.pickups = [{ x: P.x, y: P.y, type: 'knife', temp: 20, t: 0 }];
  updPickups(DT);
  assert.equal(G.cash, cash + 10);
  down('dead');
  assert.equal(P.knife, false, 'lost when wasted');
  P.knife = true;
  G.screen = 'play';
  down('busted');
  assert.equal(P.knife, false, 'and when busted');
});

test('knives lie about the city, and someone the player kills sometimes drops one', () => {
  let knives = 0;
  for (let i = 0; i < 2000; i++) if (placePickup({}).type === 'knife') knives++;
  assert.ok(Math.abs(knives / 2000 - KNIFE.map) < 0.03, `${knives} of 2000 pickups are knives`);
  let dropped = 0;
  for (let i = 0; i < 1000; i++) {
    G.pickups = [];
    const q = still(0);
    G.peds = [q];
    killPed(q, true);
    if (G.pickups.some((k) => k.type === 'knife')) dropped++;
  }
  assert.ok(Math.abs(dropped / 1000 - KNIFE.drop) < 0.04, `${dropped} of 1000 dropped a knife`);
  // Nobody drops one for a player who already has one.
  P.knife = true;
  for (let i = 0; i < 300; i++) {
    G.pickups = [];
    const q = still(0);
    G.peds = [q];
    killPed(q, true);
    assert.equal(
      G.pickups.some((k) => k.type === 'knife'),
      false,
    );
  }
});

test('the HUD says what fire does: AMMO and two digits, then KNIFE or FIST, clear of the car bar', () => {
  P.ammo = 7;
  assert.equal(weaponLabel(), 'AMMO07');
  P.ammo = AMMO_MAX;
  assert.equal(weaponLabel(), 'AMMO99');
  P.ammo = 0;
  P.knife = true;
  assert.equal(weaponLabel(), 'KNIFE');
  P.knife = false;
  assert.equal(weaponLabel(), 'FIST');
  // Right-aligned, the longest starts after the car's health bar ends (x 268).
  for (const l of ['AMMO99', 'KNIFE', 'FIST']) assert.ok(SW - l.length * 8 >= 268, l);
});

test('ammo stops at 99, so it always fits in two digits', () => {
  P.ammo = 90;
  G.pickups = [{ x: P.x, y: P.y, type: 'ammo', t: 0 }];
  updPickups(DT);
  assert.equal(P.ammo, AMMO_MAX);
  G.pickups = [{ x: P.x, y: P.y, type: 'ammo', t: 0 }];
  updPickups(DT);
  assert.equal(P.ammo, AMMO_MAX);
});
