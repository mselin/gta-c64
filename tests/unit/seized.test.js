// SPDX-License-Identifier: GPL-2.0-or-later
// The police take the player's weapons, the knife and all the ammo, when they bust the player, and when the player
// is wasted with them about or by an officer's shot. Wasted with no police about, the player keeps both.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KIND, KO, NOTICE } from '../../js/config.js';
import { genMap } from '../../js/world.js';
import { G, P, resetState } from '../../js/state.js';
import { mkCar, mkPed } from '../../js/entities.js';
import { down, hurt, respawn } from '../../js/player.js';
import { policeNear } from '../../js/heat.js';
import { updBullets } from '../../js/items.js';

// Open pavement beside the hospital's west wall.
const AT = { x: 226, y: 304 };

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  G.cars = [];
  G.peds = [];
  G.cash = 1000;
  Object.assign(P, AT, { ammo: 9, knife: true });
});
const armed = () => P.ammo === 9 && P.knife;
const disarmed = () => P.ammo === 0 && !P.knife;
/** An officer on foot `d` pixels east of the player. */
const officer = (d) => G.peds.push(Object.assign(mkPed(AT.x + d, AT.y, 'cop'), { spd: 0 }));
/** A police car `d` pixels east of the player, chasing ('cop') or on patrol in traffic ('traffic'). */
function cruiser(d, ai) {
  const c = mkCar(KIND.police, AT.x + d, AT.y, 0);
  Object.assign(c, { ai, driver: true });
  G.cars.push(c);
  return c;
}

test('busted: the police take the knife and the ammo, and say so', () => {
  down('busted');
  assert.ok(disarmed(), 'gone the moment the player is arrested');
  respawn();
  assert.equal(G.screen, 'play');
  assert.ok(disarmed(), 'and still gone at the station');
  assert.match(G.msgTxt, /CIVIL ASSET FORFEITURE: -\$200\. YOUR WEAPONS ARE NOW "EVIDENCE"/);
});

test('wasted with no police about: the player keeps the knife and the ammo', () => {
  down('dead');
  assert.ok(armed());
  respawn();
  assert.ok(armed(), 'still armed at the hospital');
  assert.equal(G.msgTxt, 'ST. INVOICE HOSPITAL: AMBULANCE RIDE -$500 (OUT OF NETWORK)');
});

test('wasted with an officer on foot near: the police take them, and the hospital says so', () => {
  officer(NOTICE.foot - 2);
  hurt(999, 'A PEDESTRIAN. IN THIS ECONOMY?');
  assert.equal(G.screen, 'down');
  assert.ok(disarmed());
  respawn();
  assert.ok(disarmed());
  assert.match(G.msgTxt, /OUT OF NETWORK\)\. THE POLICE KEPT YOUR WEAPONS AS "EVIDENCE"$/);
});

test('an officer too far off, or knocked down, takes nothing', () => {
  officer(NOTICE.foot + 2);
  assert.equal(policeNear(), false, 'beyond the distance an officer notices the player at');
  officer(10);
  G.peds[1].ko = KO.t;
  assert.equal(policeNear(), false, 'flat on the ground');
  down('dead');
  assert.ok(armed());
});

test('a chasing police car near takes them; one farther off does not', () => {
  cruiser(NOTICE.car + 2, 'cop');
  assert.equal(policeNear(), false);
  cruiser(NOTICE.car - 2, 'cop');
  assert.equal(policeNear(), true);
  down('dead');
  assert.ok(disarmed());
});

test('a manned patrol car near takes them; an empty or wrecked one does not', () => {
  const c = cruiser(NOTICE.patrol - 2, 'traffic');
  assert.equal(policeNear(), true, 'on patrol, with an officer at the wheel');
  c.driver = false;
  assert.equal(policeNear(), false, 'parked, nobody in it');
  Object.assign(c, { driver: true, dead: true });
  assert.equal(policeNear(), false, 'a wreck');
  Object.assign(c, { dead: false, kind: KIND.taxi });
  assert.equal(policeNear(), false, 'and a taxi is not the police');
  c.kind = KIND.police;
  cruiser(NOTICE.patrol + 2, 'traffic');
  G.cars.shift();
  assert.equal(policeNear(), false, 'too far off');
});

test('the police car the player is driving is not the police', () => {
  const c = cruiser(0, null);
  c.driver = true;
  P.car = c;
  assert.equal(policeNear(), false);
  hurt(999, 'YOUR NO-CLAIMS BONUS IS GONE. SO ARE YOU.');
  assert.equal(P.car, null);
  assert.ok(armed());
});

test('at the wheel, the police are looked for round the car, before the player leaves it', () => {
  const c = mkCar(KIND.taxi, AT.x + 400, AT.y, 0);
  c.driver = true;
  G.cars.push(c);
  P.car = c;
  cruiser(400 + NOTICE.car - 2, 'cop');
  down('dead');
  assert.ok(disarmed(), 'a chasing car beside the burning taxi, far from where the player got in');
});

test('shot dead by an officer, however far off: the police take them', () => {
  officer(NOTICE.foot * 3);
  assert.equal(policeNear(), false, 'the officer who fired is out of sight');
  P.hp = 5;
  G.bullets = [{ x: P.x, y: P.y, vx: 0, vy: 0, l: 0.5, own: 1 }];
  updBullets(1 / 60);
  assert.equal(G.screen, 'down');
  assert.ok(disarmed());
});
