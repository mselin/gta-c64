// SPDX-License-Identifier: GPL-2.0-or-later
// Cursed driver assistance (js/adas.js): lane assist that grabs the wheel now and then, emergency braking that
// stops for people and cars on the move and for things standing still only sometimes, and anti-theft that stops a
// stolen car for good and sets off its alarm. Only ever while the player drives.
import { test, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ADAS, ALARM_SAYS, BLD, KIND, MW, WALK } from '../../js/config.js';
import { HOSP, genMap, map } from '../../js/world.js';
import { G, K, P, edge, resetState } from '../../js/state.js';
import { mkCar, mkPed } from '../../js/entities.js';
import { assist, fit, fitAssists, hazard, immobilised, stopping } from '../../js/adas.js';
import { updCars } from '../../js/cars.js';
import { updPeds } from '../../js/peds.js';
import { updPlayer } from '../../js/player.js';
import { initWorld } from '../../js/game.js';

const DT = 1 / 60;
const MID = (MW * 16) / 2;
const saved = { ...ADAS };

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  map.fill(WALK); // open ground everywhere: only what a test puts there is in the way
  for (const k in K) delete K[k];
  G.peds = [];
  G.cars = [];
});
afterEach(() => Object.assign(ADAS, saved));

const speed = (c) => Math.hypot(c.vx, c.vy);
/** The player at the wheel of a sedan at (x, MID), heading east at `v`. */
function drive(x, v, ...assists) {
  const c = fit(mkCar(KIND.sedan, x, MID, 0), ...assists);
  c.vx = v;
  G.cars.push(c);
  Object.assign(P, { x: c.x, y: c.y, car: c });
  return c;
}
/** A frame of the game's world: the player, the cars, the people. */
function frame() {
  updPlayer(DT);
  updCars(DT);
  updPeds(DT);
  for (const k in edge) edge[k] = false;
}
const run = (s, each = () => {}) => {
  for (let i = 0; i < s * 60; i++) {
    frame();
    each();
  }
};
/** A wall across the way east, from the tile x is in onwards. */
const wall = (x) => {
  for (let ty = 0; ty < MW; ty++) for (let tx = Math.floor(x / 16); tx < MW; tx++) map[ty * MW + tx] = BLD;
};
const share = (n, f) => {
  let k = 0;
  for (let i = 0; i < n; i++) if (f()) k++;
  return k / n;
};
const near = (a, b, d, what) => assert.ok(Math.abs(a - b) <= d, `${what}: ${a.toFixed(3)}, not ${b} ± ${d}`);

test('some cars have each, sports cars twice as often; never the limo, nor anti-theft in a police car', () => {
  const of = (kind, n = 4000) => {
    const cars = Array.from({ length: n }, () => fitAssists(mkCar(kind, 0, 0, 0)));
    return (w) => cars.filter((c) => c[w]).length / n;
  };
  const sedan = of(KIND.sedan),
    sports = of(KIND.sports),
    police = of(KIND.police),
    limo = of(KIND.limo, 500);
  for (const [w, p] of [
    ['lane', ADAS.lane],
    ['aeb', ADAS.brake],
    ['theft', ADAS.theft],
  ]) {
    near(sedan(w), p, 0.03, `sedans with ${w}`);
    near(sports(w), p * ADAS.sports, 0.035, `sports cars with ${w}`);
    assert.equal(limo(w), 0, `no limo has ${w}`);
  }
  near(police('aeb'), ADAS.brake, 0.03, 'police cars with emergency braking');
  assert.equal(police('theft'), 0, 'no police car has anti-theft');
});

test('the car beside the hospital at the start has none of it', () => {
  genMap();
  initWorld();
  const c = G.cars.find((o) => o.x === HOSP.x + 40 && o.y === HOSP.y);
  assert.ok(c, 'the car is there');
  assert.deepEqual([c.lane, c.aeb, c.theft], [null, null, null]);
  map.fill(WALK);
});

test('cursed lane assist takes the wheel now and then at speed, says so, then gives it back', () => {
  const c = drive(MID - 400, 120, 'lane');
  c.lane.next = 0.5;
  K.up = true; // and no steering at all
  const a0 = c.a;
  run(0.45);
  assert.equal(c.a, a0, 'straight on before it takes over');
  assert.equal(G.msgTxt, '');
  let most = 0;
  run(0.1 + ADAS.swerveFor, () => (most = Math.max(most, Math.abs(c.a - a0))));
  assert.equal(G.msgTxt, 'CURSED LANE ASSIST TOOK OVER');
  assert.ok(most > 0.1, `it swerved the car (by up to ${most.toFixed(2)} radians)`);
  assert.ok(c.lane.next >= ADAS.swerveEvery[0] - 0.5, 'and will not again for a while');
  // Given back: with no steering, the car keeps the way it is pointing.
  const a1 = c.a;
  run(1);
  assert.ok(Math.abs(c.a - a1) < 1e-9, 'the wheel is the player’s again');
});

test('lane assist leaves a slow car alone', () => {
  const c = drive(MID, 0, 'lane');
  c.lane.next = 0.2;
  K.down = false;
  run(3);
  assert.equal(c.lane.next, 0.2, 'its time does not run below ' + ADAS.swerveFrom + ' px/s');
  assert.equal(c.lane.left, 0);
});

for (const aeb of [true, false]) {
  test(`${aeb ? 'emergency braking stops the car short of' : 'without emergency braking, the car runs over'} someone walking towards it`, () => {
    const c = drive(MID - 120, 140, ...(aeb ? ['aeb'] : [])),
      p = Object.assign(mkPed(MID, MID, 'civ'), { dx: -1, dy: 0, t: 1e9 });
    G.peds = [p];
    K.up = true; // flat out at them
    let stopped = false;
    run(2, () => {
      if (speed(c) < 5 && G.peds.includes(p)) stopped = true;
      if (stopped) K.up = false;
    });
    if (aeb) {
      assert.ok(stopped, 'the car stopped');
      assert.ok(G.peds.includes(p) && !(p.ko > 0), 'and they are unhurt');
      assert.equal(G.msgTxt, 'EMERGENCY BRAKING ENGAGED');
    } else assert.equal(G.peds.includes(p), false, 'they are run over');
  });
}

test('emergency braking brakes for a moving car every time, and for one standing still only sometimes', () => {
  const ahead = (v) => () => {
    G.cars = [];
    const c = drive(MID - 45, 140, 'aeb'),
      o = mkCar(KIND.sedan, MID, MID, 0);
    o.vx = v;
    G.cars.push(o);
    assert.ok(hazard(c, 140), 'the car ahead is nearer than it can stop');
    return assist(c, 1, 0, DT).thr < 0;
  };
  assert.equal(share(100, ahead(60)), 1, 'a moving car: every time');
  near(share(600, ahead(0)), ADAS.brakeStill, 0.07, 'a parked car');
});

test('emergency braking sees a wall only sometimes, and keeps to what it decided as it comes up to it', () => {
  const at = MID + 32; // the edge of a tile
  wall(at);
  const tries = share(600, () => {
    G.cars = [];
    // Its nose a little nearer the wall than it can stop in.
    const c = drive(at - KIND.sedan.L / 2 - stopping({ kind: KIND.sedan }, 140) + 6, 140, 'aeb');
    const first = assist(c, 1, 0, DT).thr < 0;
    for (let i = 0; i < 10; i++) assert.equal(assist(c, 1, 0, DT).thr < 0, first, 'the same each frame');
    return first;
  });
  near(tries, ADAS.brakeStill, 0.07, 'a wall');
});

for (const sees of [1, 0]) {
  test(`emergency braking that ${sees ? 'sees' : 'misses'} a wall ${sees ? 'stops short of it' : 'lets the car hit it'}`, () => {
    ADAS.brakeStill = sees;
    wall(MID + 60);
    const c = drive(MID - 150, 150, 'aeb'),
      hp = c.hp;
    K.up = true;
    run(1.5, () => {
      if (speed(c) < 5) K.up = false;
    });
    if (sees) {
      assert.equal(c.hp, hp, 'no damage');
      assert.equal(G.msgTxt, 'EMERGENCY BRAKING ENGAGED');
    } else assert.ok(c.hp < hp, 'it crashed');
  });
}

test('anti-theft stops the car a while after it is stolen, for good, and sets off its alarm', () => {
  const c = drive(MID - 400, 100, 'theft');
  c.theft.left = 1;
  K.up = true;
  run(0.9);
  assert.equal(immobilised(c), false);
  run(0.2);
  assert.equal(immobilised(c), true);
  assert.equal(G.msgTxt, 'ANTI-THEFT ENGAGED: ENGINE IMMOBILISED');
  assert.ok(c.alarm > 0, 'the alarm sounds');
  // The player keeps their foot down; the car stops and stays stopped.
  run(3);
  assert.ok(speed(c) < 1, `stopped (${speed(c).toFixed(1)} px/s)`);
  const x = c.x;
  let flashes = 0,
    was = c.alarmHi;
  run(2, () => {
    if (c.alarmHi !== was) flashes++;
    was = c.alarmHi;
  });
  assert.ok(Math.abs(c.x - x) < 0.5, 'and goes nowhere');
  near(flashes / 2, 1 / ADAS.alarmBeat, 1, 'its lights change with each note');
  // Out and in again: still nothing.
  K.up = false;
  edge.use = true;
  frame();
  assert.equal(P.car, null, 'the player gets out');
  edge.use = true;
  frame();
  assert.equal(P.car, c, 'and back in');
  assert.equal(G.msgTxt, 'THE IMMOBILISER SAYS NO');
  K.up = true;
  run(1);
  assert.ok(speed(c) < 1, 'it still will not go');
  // The alarm stops in the end.
  run(ADAS.alarmFor);
  assert.equal(c.alarm <= 0 && !c.alarmHi, true, 'the alarm has stopped');
});

for (const near of [true, false]) {
  test(`a car alarm ${near ? 'the player can hear has its say on the status line' : 'out of earshot says nothing'}`, () => {
    const c = drive(MID - 200, 60, 'theft');
    c.theft.left = 0.05;
    run(0.2);
    assert.equal(G.msgTxt, 'ANTI-THEFT ENGAGED: ENGINE IMMOBILISED');
    if (!near) Object.assign(P, { car: null, x: c.x, y: c.y - ADAS.alarmHeard - 20 });
    run(ADAS.alarmSay - 0.5);
    const before = G.msgTxt;
    run(0.8);
    if (near) {
      assert.equal(
        before,
        'ANTI-THEFT ENGAGED: ENGINE IMMOBILISED',
        'not before the anti-theft message has had its time',
      );
      assert.ok(ALARM_SAYS.includes(G.msgTxt), `one of the alarm's lines ("${G.msgTxt}")`);
    } else assert.ok(!ALARM_SAYS.includes(G.msgTxt), 'nothing about an alarm the player cannot hear');
  });
}

test('none of it does anything for the city’s own drivers', () => {
  const c = fit(mkCar(KIND.sedan, MID, MID, 0), 'lane', 'aeb', 'theft');
  c.vx = 120;
  c.lane.next = 0.1;
  c.theft.left = 0.1;
  G.cars = [c, mkCar(KIND.sedan, MID + 40, MID, 0)];
  P.x = MID;
  P.y = MID + 200;
  run(2);
  assert.equal(immobilised(c), false, 'no anti-theft');
  assert.equal(c.lane.left, 0, 'no lane assist');
  assert.equal(c.aeb.on, false, 'no emergency braking');
  assert.equal(G.msgTxt, '');
});
