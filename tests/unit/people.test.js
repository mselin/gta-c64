// SPDX-License-Identifier: GPL-2.0-or-later
// People on foot: how big they are drawn, hard pixels, the walk and the arm out, who looks like whom, and
// hits that match what is on screen.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HIT, KIND, PERSON } from '../../js/config.js';
import { genMap } from '../../js/world.js';
import { G, K, P, resetState } from '../../js/state.js';
import { CIV_HAIR, CIV_LEGS, CIV_SHIRTS, mkCar, mkPed } from '../../js/entities.js';
import {
  ARM_OUT_T,
  CELL,
  COP,
  FRAME,
  OUTLINE,
  PLAYER_OUTLINE,
  POSES,
  PUNCH,
  SHOOT,
  STAND,
  WALK_CYCLE,
  colourAt,
  frame,
  lookOf,
  outlineOf,
  pixels,
  poseOf,
  walkPose,
} from '../../js/figures.js';
import { updBullets } from '../../js/items.js';
import { updPeds } from '../../js/peds.js';
import { updPlayer } from '../../js/player.js';
import { updCars } from '../../js/cars.js';

const DT = 1 / 60;
const TYPES = ['civ', 'scoot', 'skate', 'cop', 'cult'];
const ANGLES = Array.from({ length: 16 }, (_, a) => (a / 16) * Math.PI * 2);
/** The filled pixels of a frame, as [x, y] pairs. */
const cells = (px) => [...px].flatMap((c, i) => (c >= 0 ? [[i % FRAME, Math.floor(i / FRAME)]] : []));
const same = (a, b) => a.every((c, i) => c === b[i]);
const everyone = () => [P, ...TYPES.map((t) => mkPed(0, 0, t))];

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  for (const k in K) delete K[k];
});

test('people are drawn about as big as a swimmer: 10 to 12 px across, and fit their frames', () => {
  for (const p of everyone()) {
    const ys = cells(pixels(p, STAND, 0)).map(([, y]) => y),
      across = Math.max(...ys) - Math.min(...ys) + 1;
    assert.ok(across >= 10 && across <= 12, `${p.type} is ${across} px across`);
    // Whatever the pose and whichever way they face, there is room in the frame for every outline round it.
    const n = outlineOf(p).length;
    for (let pose = 0; pose < POSES; pose++)
      for (const an of ANGLES)
        for (const [x, y] of cells(pixels(p, pose, an)))
          assert.ok(
            Math.min(x, y, FRAME - 1 - x, FRAME - 1 - y) >= n,
            `${p.type} pose ${pose} fits its frame`,
          );
  }
});

test('hard pixels: one of the 16 colours each, in whole CELL x CELL blocks at every angle', () => {
  assert.ok(CELL === 1 || CELL === 2);
  for (const p of everyone())
    for (let pose = 0; pose < POSES; pose++)
      for (const an of ANGLES) {
        for (const c of frame(p, pose, an)) assert.ok(c === -1 || (Number.isInteger(c) && c >= 0 && c < 16));
        // Before the outlines go round it, the figure is made of whole blocks, each one colour.
        const px = pixels(p, pose, an);
        for (let y = 0; y < FRAME; y += CELL)
          for (let x = 0; x < FRAME; x += CELL)
            for (let j = 0; j < CELL; j++)
              for (let i = 0; i < CELL; i++)
                assert.equal(
                  px[(y + j) * FRAME + x + i],
                  px[y * FRAME + x],
                  `${p.type} pose ${pose}: a whole block`,
                );
      }
});

test('outlines: one unbroken black ring round everyone, and a white one round the player alone', () => {
  for (const p of everyone()) {
    const rings = outlineOf(p),
      px = frame(p, STAND, ANGLES[3]),
      inner = pixels(p, STAND, ANGLES[3]),
      on = (a, x, y) => x >= 0 && y >= 0 && x < FRAME && y < FRAME && a[y * FRAME + x] >= 0;
    // Every pixel beside the figure is the first ring's colour.
    for (const [x, y] of cells(px))
      if (
        !on(inner, x, y) &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([i, j]) => on(inner, x + i, y + j))
      )
        assert.equal(px[y * FRAME + x], rings[0], `${p.type}: black right round`);
    if (lookOf(p) === 'player') assert.ok(px.includes(PLAYER_OUTLINE[1]), 'white round the black');
  }
});

test('the walk: five poses, arms and feet swinging opposite ways, in a cycle of steps', () => {
  const civ = Object.assign(mkPed(0, 0, 'civ'), { legs: 12, skin: 10 });
  const walk = [0, 1, 2, 3, 4].map((pose) => pixels(civ, pose, 0));
  for (let i = 0; i < 5; i++)
    for (let j = i + 1; j < 5; j++) assert.equal(same(walk[i], walk[j]), false, `poses ${i} and ${j} differ`);
  // Full stride: the left foot is out in front with the right hand, the right foot and the left hand behind.
  const shoe = civ.legs;
  assert.equal(colourAt(civ, 4, 3.6, -1.9), shoe, 'left foot forward');
  assert.equal(colourAt(civ, 4, -3.6, 1.9), shoe, 'right foot back');
  assert.equal(colourAt(civ, 4, 2.2, 5), civ.skin, 'right hand forward');
  assert.equal(colourAt(civ, 4, -2.2, -5), civ.skin, 'left hand back');
  // And the other way round at the other end of the stride.
  assert.equal(colourAt(civ, 0, -3.6, -1.9), shoe);
  assert.equal(colourAt(civ, 0, 3.6, 1.9), shoe);
  assert.equal(colourAt(civ, 0, -2.2, 5), civ.skin);
  assert.equal(colourAt(civ, 0, 2.2, -5), civ.skin);
  // Standing, both feet are under the body and both hands at the sides.
  assert.equal(colourAt(civ, STAND, 3.6, -1.9), -1);
  assert.equal(colourAt(civ, STAND, 0, 5), civ.skin);
  // The cycle goes through every pose, a step at a time, and starts and stops standing.
  assert.deepEqual([...new Set(WALK_CYCLE)].sort(), [0, 1, 2, 3, 4]);
  for (let i = 0; i < WALK_CYCLE.length; i++)
    assert.equal(Math.abs(WALK_CYCLE[i] - WALK_CYCLE[(i + 1) % WALK_CYCLE.length]), 1);
  assert.equal(walkPose(0), STAND);
  // Scooter riders, skaters and cultists hold still whatever the walk is doing.
  for (const type of ['scoot', 'skate', 'cult']) {
    const p = mkPed(0, 0, type);
    for (let pose = 1; pose < 5; pose++)
      assert.ok(same(pixels(p, 0, 0), pixels(p, pose, 0)), `${type} holds still`);
  }
});

test('the player walks, and stands in the middle pose once they stop', () => {
  Object.assign(P, { x: 226, y: 304, a: 0 });
  G.peds = [];
  G.cars = [];
  K.right = true;
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    updPlayer(DT);
    seen.add(poseOf(P));
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4], 'a second of walking shows all five poses');
  K.right = false;
  updPlayer(DT);
  assert.equal(poseOf(P), STAND);
});

test('the arm goes out in front, with a gun or a fist, when the player fires or punches', () => {
  const p = P;
  for (const pose of [SHOOT, PUNCH]) {
    const hand = cells(pixels(p, pose, 0)).filter(([x, y]) => pixels(p, pose, 0)[y * FRAME + x] === p.skin);
    assert.ok(Math.max(...hand.map(([x]) => x)) - FRAME / 2 >= 7, 'the hand is at least 7 px out in front');
  }
  assert.ok(pixels(p, SHOOT, 0).includes(11), 'a dark grey gun in it');
  assert.ok(!pixels(p, PUNCH, 0).includes(11), 'and none in a fist');
  // Firing with ammo, then punching with none: each holds the arm out for ARM_OUT_T, then the walk comes back.
  Object.assign(P, { x: 226, y: 304, a: 0, ammo: 1, cd: 0 });
  G.peds = [];
  G.cars = [];
  K.fire = true;
  updPlayer(DT);
  assert.equal(poseOf(P), SHOOT);
  assert.equal(P.ammo, 0);
  K.fire = false;
  for (let t = 0; t < ARM_OUT_T + 0.4; t += DT) updPlayer(DT);
  assert.equal(poseOf(P), STAND);
  K.fire = true;
  updPlayer(DT);
  assert.equal(poseOf(P), PUNCH);
});

test('a police officer puts an arm out when they fire', () => {
  G.heat = 3;
  const cop = Object.assign(mkPed(P.x + 40, P.y, 'cop'), { cd: 0 });
  G.peds = [cop];
  G.cars = [];
  updPeds(DT);
  assert.equal(G.bullets.length, 1);
  assert.equal(poseOf(cop), SHOOT);
});

test("no pedestrian can get the player's look or a police officer's", () => {
  assert.equal(lookOf(P), 'player');
  assert.deepEqual(outlineOf(P), PLAYER_OUTLINE);
  const white = PLAYER_OUTLINE.at(-1);
  assert.ok(!OUTLINE.includes(white), 'the white outline is the player alone');
  assert.ok(!CIV_SHIRTS.includes(P.shirt), "nobody else wears the player's jacket");
  assert.ok(!CIV_SHIRTS.includes(COP.shirt) && !CIV_SHIRTS.includes(COP.legs), 'or a police shirt');
  assert.ok(!CIV_LEGS.includes(COP.legs), 'or police trousers');
  assert.ok(!CIV_HAIR.includes(COP.cap), 'or a white police cap');
  for (let i = 0; i < 500; i++) {
    for (const type of ['civ', 'scoot', 'skate']) {
      const p = mkPed(0, 0, type);
      assert.notEqual(lookOf(p), 'player');
      assert.deepEqual(outlineOf(p), OUTLINE);
      assert.notEqual(p.shirt, P.shirt);
      assert.notEqual(p.shirt, COP.shirt);
      assert.notEqual(p.legs, COP.legs);
      assert.notEqual(p.hair, COP.cap);
      assert.notEqual(p.hair, p.shirt, 'a head never vanishes into the shirt');
    }
    const cop = mkPed(0, 0, 'cop');
    assert.deepEqual([cop.shirt, cop.legs, cop.hair], [COP.shirt, COP.legs, COP.cap]);
    assert.deepEqual(outlineOf(cop), OUTLINE);
  }
  // Once a cult meeting breaks up, its members become ordinary passers-by, still in their robes' colours.
  const cultist = Object.assign(mkPed(0, 0, 'cult'), { type: 'civ' });
  assert.deepEqual(outlineOf(cultist), OUTLINE);
  assert.notEqual(cultist.shirt, COP.shirt);
});

test("a police officer's white cap and gold badge are drawn, and no passer-by wears the uniform", () => {
  const has = (p, col) => ANGLES.some((an) => pixels(p, STAND, an).includes(col));
  const cop = mkPed(0, 0, 'cop');
  assert.ok(has(cop, COP.cap) && has(cop, 7), 'white cap, gold badge');
  for (let i = 0; i < 200; i++) assert.equal(has(mkPed(0, 0, 'civ'), COP.shirt), false);
});

// A pedestrian on the pavement beside the hospital's west wall, or on the street north of it.
const PAVEMENT = { x: 226, y: 304 };
const STREET = { x: 300, y: 208 };
const standing = (x, y) => Object.assign(mkPed(x, y, 'civ'), { spd: 0, t: 9 });

test('a bullet hits someone it passes within HIT.shot of: their shoulders, as drawn', () => {
  const shoot = (dx, own) => {
    G.peds = [standing(PAVEMENT.x, PAVEMENT.y)];
    G.cars = [];
    Object.assign(P, { x: PAVEMENT.x, y: PAVEMENT.y, hp: 100 });
    G.bullets = [{ x: PAVEMENT.x + dx, y: PAVEMENT.y, vx: 0, vy: 0, l: 0.5, own }];
    updBullets(DT);
    return own ? P.hp < 100 : G.peds.length === 0;
  };
  // The shoulder is 5 screen pixels from a person's middle: 5 × PERSON city pixels, and half the bullet.
  assert.equal(HIT.shot, 5 * PERSON + 1);
  const shoulder = 5 * PERSON;
  assert.equal(shoot(shoulder, 0), true, 'the player shoots a pedestrian in the shoulder');
  assert.equal(shoot(-shoulder, 0), true, 'either shoulder');
  assert.equal(shoot(HIT.shot + 0.5, 0), false, 'a near miss');
  assert.equal(shoot(shoulder, 1), true, 'a police bullet hits the player the same way');
  assert.equal(shoot(HIT.shot + 0.5, 1), false);
});

test('a moving car runs over someone it passes within HIT.car of its middle', () => {
  const pass = (dy) => {
    const c = mkCar(KIND.sedan, STREET.x, STREET.y, 0);
    c.vx = 60;
    G.cars = [c];
    G.peds = [standing(STREET.x, STREET.y + dy)];
    updPeds(DT);
    return G.peds.length === 0;
  };
  assert.equal(pass(HIT.car - 0.5), true, 'the side of the car catches their shoulder');
  assert.equal(pass(HIT.car + 0.5), false, 'but not someone half a pixel clear');
  // Its front reaches HIT.nose past the point 6 px ahead of its middle.
  const front = (dx) => {
    const c = mkCar(KIND.sedan, STREET.x, STREET.y, 0);
    c.vx = 60;
    G.cars = [c];
    G.peds = [standing(STREET.x + dx, STREET.y)];
    updPeds(DT);
    return G.peds.length === 0;
  };
  assert.equal(front(6 + HIT.nose - 0.5), true, 'the bumper is 10 px ahead and a person their shoulder deep');
  assert.equal(front(6 + HIT.nose + 0.5), false);
});

test('the player on foot is hit by a car passing within HIT.car', () => {
  const pass = (dy) => {
    resetState();
    G.screen = 'play';
    const c = mkCar(KIND.sedan, STREET.x, STREET.y, 0);
    c.vx = 60;
    G.cars = [c];
    Object.assign(P, { x: STREET.x, y: STREET.y + dy });
    updPlayer(DT);
    return P.hp < 100;
  };
  assert.equal(pass(HIT.car - 0.5), true);
  assert.equal(pass(HIT.car + 0.5), false);
});

test('traffic brakes for anyone close enough to its line that it would hit them', () => {
  const brakes = (dy, who) => {
    resetState();
    const c = mkCar(KIND.sedan, STREET.x, STREET.y + 8, 0);
    Object.assign(c, { ai: 'traffic', dir: 0, driver: true, cruise: 60, sp: 60 });
    G.cars = [c];
    G.peds = [];
    Object.assign(P, { x: 2000, y: 2000 });
    if (who === 'ped') G.peds.push(standing(c.x + 20, c.y + dy));
    else Object.assign(P, { x: c.x + 20, y: c.y + dy });
    updCars(DT);
    return c.sp < 60;
  };
  for (const who of ['ped', 'player']) {
    assert.equal(brakes(HIT.lane - 1, who), true, `${who} just inside HIT.lane of its line`);
    assert.equal(brakes(-(HIT.lane - 1), who), true);
    assert.equal(brakes(HIT.lane + 3, who), false, `${who} well clear`);
  }
});
