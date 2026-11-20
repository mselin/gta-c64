// SPDX-License-Identifier: GPL-2.0-or-later
// Big Honk, Sleazeburg's crime boss: where he lives, how he is drawn, and that nothing hurts him.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HONK, KIND, WALK } from '../../js/config.js';
import { genMap, tileAt, waterAt } from '../../js/world.js';
import { G, K, P, resetState } from '../../js/state.js';
import { mkCar, mkHonk } from '../../js/entities.js';
import {
  FLAP_BACK,
  FLAP_OUT,
  FLOAT,
  FRAME,
  HONK_POSES,
  STAND,
  frame,
  pixels,
  poseOf,
} from '../../js/figures.js';
import { updBullets } from '../../js/items.js';
import { killPed, updPeds } from '../../js/peds.js';
import { spawner } from '../../js/spawner.js';
import { initWorld } from '../../js/game.js';

const DT = 1 / 60;
const ANGLES = Array.from({ length: 16 }, (_, a) => (a / 16) * Math.PI * 2);
const cells = (px) => [...px].flatMap((c, i) => (c >= 0 ? [[i % FRAME, Math.floor(i / FRAME), c]] : []));
/** Big Honk on his own, standing on the west bank of the canal where a new game finds him. */
function honk() {
  const h = mkHonk();
  G.peds = [h];
  G.cars = [];
  G.camX = h.x - 160;
  G.camY = h.y - 88;
  return h;
}

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  for (const k in K) delete K[k];
});

test('a new game finds Big Honk on a bank of The Moat', () => {
  initWorld();
  const found = G.peds.filter((p) => p.type === 'honk');
  assert.equal(found.length, 1, 'one of him');
  const [h] = found;
  assert.ok(h.x >= HONK.x0 && h.x < HONK.x1, 'on The Moat');
  assert.equal(tileAt(h.x, h.y), WALK, 'on its pavement');
  assert.ok(waterAt(h.x + 16, h.y), 'with the canal beside him');
});

test('he is drawn as a white goose in black shades and a gold chain, with an orange beak', () => {
  const h = mkHonk();
  // Facing right, from his tail to his beak: grey tail, white body, gold chain, white neck, black shades, the
  // white front of his head, orange beak.
  const row = cells(frame(h, STAND, 0)).filter(([, y]) => y === FRAME / 2);
  const along = row.map(([, , c]) => c).filter((c, i, a) => i === 0 || c !== a[i - 1]);
  assert.deepEqual(
    along,
    [0, 15, 1, 7, 1, 0, 1, 8, 0],
    'outline, tail, body, chain, neck, shades, head, beak, outline',
  );
  // The shades are wider than his head.
  const across = (c) => cells(frame(h, STAND, 0)).filter(([, , k]) => k === c);
  const span = (list) => Math.max(...list.map(([, y]) => y)) - Math.min(...list.map(([, y]) => y)) + 1;
  const head = cells(pixels(h, STAND, 0)).filter(([x]) => x === 19); // the front of his head
  assert.ok(span(across(0).filter(([x]) => x === 16 || x === 17)) > span(head), 'shades wider than his head');
  // His own colours only, a black outline, and room in the frame at every angle and in every pose.
  for (let pose = 0; pose < HONK_POSES; pose++)
    for (const an of ANGLES)
      for (const [x, y, c] of cells(frame(h, pose, an))) {
        assert.ok([0, 1, 7, 8, 15].includes(c), `colour ${c} in pose ${pose}`);
        assert.ok(Math.min(x, y, FRAME - 1 - x, FRAME - 1 - y) >= 0, `pose ${pose} fits its frame`);
      }
});

test('flapping, his wings spread well beyond his body, out to the sides and then swept back', () => {
  const h = mkHonk();
  const width = (pose) => {
    const ys = cells(pixels(h, pose, 0)).map(([, y]) => y);
    return Math.max(...ys) - Math.min(...ys) + 1;
  };
  assert.ok(width(FLAP_OUT) >= width(STAND) + 8, `wings out: ${width(FLAP_OUT)} against ${width(STAND)}`);
  assert.ok(width(FLAP_BACK) >= width(STAND) + 8, 'and swept back');
  const xs = (pose) =>
    cells(pixels(h, pose, 0))
      .filter(([, y]) => y <= 4)
      .map(([x]) => x);
  assert.ok(
    Math.min(...xs(FLAP_BACK)) < Math.min(...xs(FLAP_OUT)),
    'swept back, the wing tips are further back',
  );
});

test('nothing hurts him: shot, run over, punched or blown up, he flaps and honks, and no crime is counted', () => {
  const ruffled = (h) => G.peds.includes(h) && h.flap > 0;
  // Shot.
  let h = honk();
  G.bullets = [{ x: h.x + 3, y: h.y, vx: 0, vy: 0, l: 0.5, own: 0 }];
  updBullets(DT);
  assert.ok(ruffled(h), 'shot');
  assert.equal(G.bullets.filter((b) => b.l > 0).length, 0, 'the bullet is spent on him');
  assert.equal(G.pops.at(-1).t, 'HONK!');
  // Run over.
  h = honk();
  const c = mkCar(KIND.sedan, h.x - 4, h.y, 0);
  c.vy = 60;
  G.cars = [c];
  updPeds(DT);
  assert.ok(ruffled(h), 'run over');
  // Punched, or caught in a blast: the same call, from the player or from a car.
  h = honk();
  killPed(h, true, P);
  assert.ok(ruffled(h), 'punched');
  h = honk();
  killPed(h, false, { x: h.x, y: h.y - 10 });
  assert.ok(ruffled(h), 'blown up');
  assert.equal(G.heatPts, 0, 'and none of it is a crime');
});

test('ruffled, he runs off flapping, away from what hit him, and nothing ruffles him again until he stops', () => {
  const h = honk();
  h.y = 52 * 16 + 8;
  killPed(h, true, { x: h.x, y: h.y - 20 }); // from the north
  const y0 = h.y,
    pops = G.pops.length;
  for (let i = 0; i < 30; i++) updPeds(DT);
  assert.ok(h.y > y0 + 15, `he ran south, away from it (${(h.y - y0).toFixed(1)} px)`);
  assert.ok([FLAP_OUT, FLAP_BACK].includes(poseOf(h)), 'flapping');
  const left = h.flap;
  killPed(h, true, P);
  assert.equal(h.flap, left, 'still flapping: no second honk');
  assert.equal(G.pops.length, pops);
  for (let i = 0; i < HONK.flapT / DT; i++) updPeds(DT);
  assert.equal(h.flap <= 0, true, 'and then he stops');
  assert.ok(![FLAP_OUT, FLAP_BACK].includes(poseOf(h)));
});

test('he wanders The Moat, banks and water, up and down the city, and never leaves it', () => {
  const h = honk();
  let swam = false,
    walked = false,
    minY = h.y,
    maxY = h.y;
  for (let i = 0; i < 20 * 60 * 30; i++) {
    updPeds(1 / 30);
    assert.ok(h.x >= HONK.x0 && h.x < HONK.x1, `on The Moat after ${i} steps (x ${h.x.toFixed(1)})`);
    swam ||= h.swim;
    walked ||= !h.swim;
    minY = Math.min(minY, h.y);
    maxY = Math.max(maxY, h.y);
  }
  assert.ok(swam && walked, 'in the canal and on its banks');
  assert.ok(maxY - minY > 200, `up and down it (${(maxY - minY).toFixed(0)} px)`);
});

test('a goose swims as fast as he walks, and afloat he is drawn as himself, not as a swimmer', () => {
  const h = honk();
  Object.assign(h, { x: 55 * 16 + 8, y: 52 * 16 + 8, dx: 0, dy: 1, t: 9 });
  assert.ok(waterAt(h.x, h.y));
  const y0 = h.y;
  updPeds(DT);
  assert.ok(Math.abs(h.y - y0 - HONK.spd * DT) < 1e-9, 'his full speed');
  assert.equal(poseOf(h), FLOAT);
});

test('the spawner never clears him away, however far off the player is', () => {
  const h = honk();
  Object.assign(P, { x: 100, y: 100, car: null });
  for (let i = 0; i < 120; i++) spawner(DT);
  assert.ok(G.peds.includes(h));
  assert.ok(
    G.peds.filter((p) => p.type !== 'honk').length > 0,
    'and others still come and go around the player',
  );
});
