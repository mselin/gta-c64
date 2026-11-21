// SPDX-License-Identifier: GPL-2.0-or-later
// How cars handle, on open ground with no walls in reach: steering held to what the tyres can grip, the
// handbrake for sliding, weight in a crash, spin from a knock off a car's middle, grass, and the same driving at
// any frame rate. See specs/design.md, Cars.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GRASS, GRIP, HANDLING, KIND, MW, ROAD } from '../../js/config.js';
import { genMap, map } from '../../js/world.js';
import { mkCar } from '../../js/entities.js';
import { carPhys, updCars } from '../../js/cars.js';
import { G, P, resetState } from '../../js/state.js';

const DT = 1 / 60;
const MID = (MW * 16) / 2;
const speed = (c) => Math.hypot(c.vx, c.vy);
const car = (kind, x = MID, y = MID, a = 0) => mkCar(kind, x, y, a);

before(() => genMap());
beforeEach(() => {
  resetState();
  map.fill(ROAD); // the whole city open road: nothing to hit
  G.cars = [];
  G.peds = [];
  P.car = null;
});

/** Full lock at a steady speed for three seconds: the turn rate, the line's radius and the slide at the end. */
function corner(kind, target, hb = false) {
  const c = car(kind);
  c.vx = target;
  let yaw = 0,
    slide = 0;
  for (let i = 0; i < 240; i++) {
    const a = c.a;
    carPhys(c, speed(c) < target ? 1 : 0, 1, DT, hb);
    if (i >= 180) {
      yaw += (c.a - a) / 60 / DT;
      slide = Math.max(slide, c.slide);
    }
  }
  return { yaw, radius: speed(c) / yaw, slide, speed: speed(c) };
}

test('slowly, a car turns on its tightest circle, about 18 across the middle', () => {
  for (const k of [KIND.sedan, KIND.sports, KIND.van]) {
    const { radius, slide } = corner(k, 40);
    assert.ok(radius > 16 && radius < 21, `${k.n}: radius ${radius.toFixed(1)}`);
    assert.equal(slide, 0);
  }
});

test('at speed, steering never asks the tyres for more than they hold: a fast car takes a wider line', () => {
  for (const k of Object.values(KIND)) {
    const top = k.max * 0.999,
      { yaw, slide, speed: v } = corner(k, top);
    assert.ok(v * yaw <= GRIP[k.n] * 1.02, `${k.n}: asks ${(v * yaw).toFixed(0)} of ${GRIP[k.n]}`);
    assert.ok(slide < 26, `${k.n}: no skid at full lock and full speed (slide ${slide.toFixed(1)})`);
    assert.ok(v > k.max * 0.95, `${k.n}: holds its speed round the bend (${v.toFixed(0)})`);
  }
  // The sports car at full speed: the old rule turned it at 3 rad/s whatever the speed, so it slid.
  const sports = corner(KIND.sports, KIND.sports.max * 0.999);
  assert.ok(sports.radius > 85, `sports car's line at full speed: radius ${sports.radius.toFixed(0)}`);
  // Below the grip, steering is as it was: a sedan at 120 still turns at 3 rad/s.
  assert.ok(Math.abs(corner(KIND.sedan, 120).yaw - 3) < 0.02);
});

test('at speed, the handbrake lets the back go: a sharper turn than the grip allows, and a slide', () => {
  // A quick pull, a quarter of a second, at the sports car's top speed, where the grip holds the turn back.
  const pull = (hb) => {
    const c = car(KIND.sports);
    c.vx = KIND.sports.max;
    let slid = 0;
    for (let i = 0; i < 15; i++) {
      carPhys(c, 0, 1, DT, hb);
      slid = Math.max(slid, c.slide);
    }
    return { turned: c.a, slid };
  };
  const yanked = pull(true),
    held = pull(false);
  assert.ok(
    yanked.turned > held.turned + 0.3,
    `turns ${yanked.turned.toFixed(2)} against ${held.turned.toFixed(2)}`,
  );
  assert.ok(
    yanked.slid > 26 && held.slid < 26,
    `and slides (${yanked.slid.toFixed(0)} against ${held.slid.toFixed(0)})`,
  );
});

test('the same driving comes out the same at 30, 60 or 144 frames a second', () => {
  const ends = [30, 60, 144].map((fps) => {
    const c = car(KIND.sedan),
      dt = 1 / fps,
      run = (s, thr, steer) => {
        for (let t = 0; t < s - 1e-9; t += dt) carPhys(c, thr, steer, dt);
      };
    run(2, 1, 0);
    run(1.5, 1, 1);
    run(1, -1, 0);
    return c;
  });
  for (const c of ends.slice(1)) {
    assert.ok(Math.hypot(c.x - ends[0].x, c.y - ends[0].y) < 3, 'ends within 3 pixels');
    assert.ok(Math.abs(c.a - ends[0].a) < 0.05);
  }
});

/** Car `ka` at 150 px/s into a still car `kb` head-on along x; their speeds a quarter of a second later. */
function ram(ka, kb) {
  const a = car(ka, MID - 30),
    b = car(kb);
  a.vx = 150;
  G.cars = [a, b];
  for (let i = 0; i < 15; i++) updCars(DT);
  return { a, b };
}

test('in a crash the heavier car pushes the lighter one further, and the lighter one comes off worse', () => {
  assert.ok(KIND.van.m > KIND.sedan.m && KIND.sedan.m > KIND.sports.m && KIND.limo.m > KIND.sedan.m);
  const vanHits = ram(KIND.van, KIND.sports),
    sportsHits = ram(KIND.sports, KIND.van);
  assert.ok(
    vanHits.b.vx > sportsHits.b.vx + 15,
    'a van sends a sports car off faster than the other way round',
  );
  assert.ok(vanHits.a.vx > sportsHits.a.vx, 'and keeps more of its own speed');
  const lostSports = KIND.sports.hp - vanHits.b.hp,
    lostVan = KIND.van.hp - vanHits.a.hp;
  assert.ok(lostSports > lostVan, `sports car loses ${lostSports.toFixed(1)}, the van ${lostVan.toFixed(1)}`);
  // Two cars the same weight: shared equally, as before.
  const same = ram(KIND.sedan, KIND.sedan);
  assert.ok(Math.abs(KIND.sedan.hp - same.a.hp - (KIND.sedan.hp - same.b.hp)) < 1e-9);
});

test('a knock off the middle spins a car, the way it was pushed; a knock on the middle hardly turns it', () => {
  const tbone = (offset) => {
    // A sedan coming down at 150 into the side of a still one facing east, `offset` along it from its middle.
    const a = car(KIND.sedan, MID + offset, MID - 25, Math.PI / 2),
      b = car(KIND.sedan);
    a.vy = 150;
    G.cars = [a, b];
    for (let i = 0; i < 60; i++) updCars(DT);
    return b.a;
  };
  const rear = tbone(-6),
    front = tbone(6),
    middle = tbone(0);
  assert.ok(
    rear < -0.4,
    `hit behind the middle, its tail goes down and its nose up: turned ${rear.toFixed(2)}`,
  );
  assert.ok(front > 0.4, `hit ahead of the middle, the other way: turned ${front.toFixed(2)}`);
  assert.ok(Math.abs(middle) < 0.15, `hit in the middle: turned ${middle.toFixed(2)}`);
});

test("the tyres stop a spin, and a car's own grip decides how soon", () => {
  const c = car(KIND.sedan);
  c.w = 4;
  c.vx = 60;
  let t = 0;
  while (c.w !== 0 && t < 3) {
    carPhys(c, 0, 0, DT);
    t += DT;
  }
  const expected = 4 / (GRIP.sedan * HANDLING.spinGrip);
  assert.ok(
    Math.abs(t - expected) < 0.05,
    `stopped spinning after ${t.toFixed(2)} s (expected ${expected.toFixed(2)})`,
  );
  // A car standing still that is set spinning turns too, and stops.
  const d = car(KIND.van);
  d.w = 2;
  G.cars = [d];
  for (let i = 0; i < 120; i++) updCars(DT);
  assert.equal(d.w, 0);
  assert.notEqual(d.a, 0);
});

test('grass is slippery and hard going: a car slows sooner and tops out lower', () => {
  const coast = (tile) => {
    map.fill(tile);
    const c = car(KIND.sedan);
    c.vx = 150;
    for (let i = 0; i < 180; i++) carPhys(c, 0, 0, DT);
    return c.x - MID;
  };
  const top = (tile) => {
    // From the west edge, with room to reach top speed before the east one.
    map.fill(tile);
    const c = car(KIND.sedan, 100);
    for (let i = 0; i < 360; i++) carPhys(c, 1, 0, DT);
    return speed(c);
  };
  assert.ok(coast(GRASS) < coast(ROAD) * 0.7, 'coasts less than 70 % as far');
  const g = top(GRASS);
  assert.ok(g < KIND.sedan.max * 0.8 && g > 60, `top speed on grass ${g.toFixed(0)}`);
});
