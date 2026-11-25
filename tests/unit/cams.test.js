// SPDX-License-Identifier: GPL-2.0-or-later
// GAGGLE cameras (js/cams.js): a crime one sees counts for more and brings the police at once; they report
// reckless driving; while one sees the player with heat, the heat does not cool; ramming or shooting one sets off
// its alarm, which reports it, and then it goes dark until the city puts it back up.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLD,
  CAM,
  CAM_DOWN,
  CAM_SEEN,
  CAM_TAMPER,
  KIND,
  MW,
  NB,
  BLK,
  PLAZA,
  ROAD,
  WALK,
} from '../../js/config.js';
import { genMap, map, tileAt } from '../../js/world.js';
import { G, P, resetState } from '../../js/state.js';
import { mkCar } from '../../js/entities.js';
import { camSpots, mkCam, seenBy, updCams } from '../../js/cams.js';
import { crime, updHeat } from '../../js/heat.js';
import { updBullets } from '../../js/items.js';

const DT = 1 / 60;
const MID = (MW * 16) / 2;

before(() => genMap());
beforeEach(() => {
  resetState();
  genMap();
  G.screen = 'play';
  G.peds = [];
  G.cars = [];
  G.camX = G.camY = 0;
});
/** Open pavement everywhere, and one camera in the middle of it. */
function open() {
  map.fill(WALK);
  const cam = mkCam(MID, MID);
  G.cams = [cam];
  Object.assign(P, { x: MID + 30, y: MID, car: null });
  return cam;
}
const run = (s, each = () => {}) => {
  for (let i = 0; i < s * 60; i++) {
    G.clock += DT;
    updCams(DT);
    each();
  }
};
const drive = (x, y, v) => {
  const c = mkCar(KIND.sedan, x, y, 0);
  c.vx = v;
  G.cars = [c];
  Object.assign(P, { x, y, car: c });
  return c;
};

test('the cameras stand on the pavement at about one crossing in five', () => {
  const spots = camSpots(),
    crossings = (NB + 1) * (NB + 1);
  assert.ok(
    spots.length > crossings / 7 && spots.length < crossings / 3.5,
    `${spots.length} of ${crossings}`,
  );
  for (const s of spots) {
    assert.ok([WALK, PLAZA].includes(tileAt(s.x, s.y)), 'on pavement or plaza');
    const cx = Math.round((s.x - 16) / BLK) * BLK + 16,
      cy = Math.round((s.y - 16) / BLK) * BLK + 16;
    assert.ok(Math.hypot(s.x - cx, s.y - cy) < 32, 'at a crossing');
  }
});

test('a crime a camera sees counts half again, flashes its light and says so; one it cannot see counts as before', () => {
  const cam = open();
  crime(4);
  assert.equal(G.heatPts, 4 * (1 + CAM.boost));
  assert.ok(cam.flash > 0, 'its light flashes');
  assert.ok(CAM_SEEN.includes(G.msgTxt), `it says so ("${G.msgTxt}")`);
  // Too far away.
  G.heatPts = 0;
  P.x = MID + CAM.see + 10;
  crime(4);
  assert.equal(G.heatPts, 4);
  // Behind a building.
  G.heatPts = 0;
  P.x = MID + 40;
  map[Math.floor(MID / 16) * MW + Math.floor((MID + 20) / 16)] = BLD;
  crime(4);
  assert.equal(G.heatPts, 4, 'a building in the way');
});

test('it says something about a crime at most every few seconds', () => {
  open();
  crime(1);
  G.msgTxt = '';
  run(1);
  crime(1);
  assert.equal(G.msgTxt, '', 'not again so soon');
  run(CAM.sayGap);
  crime(1);
  assert.ok(CAM_SEEN.includes(G.msgTxt), 'but again later');
});

test('speeding where a camera sees it is reported, at most once every few seconds; so is driving fast on the pavement', () => {
  open();
  map.fill(ROAD);
  drive(MID + 30, MID, CAM.speeding + 10);
  run(CAM.again + 0.5);
  assert.equal(G.heatPts, 2 * CAM.reckless * (1 + CAM.boost), 'twice in 4.5 seconds');
  G.heatPts = 0;
  drive(MID + 30, MID, CAM.speeding - 10);
  G.cams[0].saw = -99;
  run(1);
  assert.equal(G.heatPts, 0, 'not below the limit on the road');
  map.fill(WALK);
  drive(MID + 30, MID, CAM.pavement + 10);
  run(0.1);
  assert.ok(G.heatPts > 0, 'but on the pavement it is');
});

test('ramming a camera sets off its alarm, which reports it; then it goes dark, and sees nothing', () => {
  const cam = open();
  drive(MID - 5, MID, CAM.knock - 5);
  run(0.1);
  assert.equal(cam.alarm, 0, 'a nudge does nothing');
  drive(MID - 5, MID, 60);
  run(DT);
  assert.ok(cam.alarm > 0, 'its alarm sounds');
  assert.ok(CAM_TAMPER.includes(G.msgTxt), `"${G.msgTxt}"`);
  assert.equal(G.heatPts, CAM.tamper, 'the tampering is a crime');
  let flashes = 0,
    was = cam.hi;
  run(CAM.alarm - 0.2, () => {
    if (cam.hi !== was) flashes++;
    was = cam.hi;
  });
  assert.ok(flashes > 10, `its light flashes with the alarm (${flashes})`);
  assert.equal(cam.dead, false, 'not dark before the alarm has run out');
  run(0.3);
  assert.equal(cam.dead, true, 'then dark');
  assert.ok(CAM_DOWN.includes(G.msgTxt), `"${G.msgTxt}"`);
  assert.equal(seenBy(P.x, P.y), null, 'it sees nothing');
});

test('shooting a camera does the same', () => {
  const cam = open();
  G.bullets = [{ x: MID - 30, y: MID - 5, vx: 240, vy: 0, l: 1, own: 0 }];
  for (let i = 0; i < 20 && G.bullets.length; i++) updBullets(DT);
  assert.equal(G.bullets.length, 0, 'the bullet stops there');
  assert.ok(cam.alarm > 0, 'its alarm sounds');
  assert.ok(CAM_TAMPER.includes(G.msgTxt));
  run(CAM.alarm + 0.1);
  assert.equal(cam.dead, true);
});

test('the city puts a dark camera back up a while later, where nobody is looking', () => {
  const cam = open();
  Object.assign(cam, { dead: true, fixT: CAM.fix });
  G.camX = cam.x - 50; // on screen
  G.camY = cam.y - 40;
  run(CAM.fix + 1);
  assert.equal(cam.dead, true, 'not while the player can see it');
  G.camX = G.camY = 0;
  run(1);
  assert.equal(cam.dead, false, 'back up out of sight');
});

test('while a camera sees the player with heat, the heat does not cool', () => {
  open();
  Object.assign(G, { heat: 1, heatPts: 8, heatCool: 0 });
  const tick = () => updHeat(DT);
  run(12, tick);
  assert.equal(G.heat, 1, 'in view: still 1 after 12 seconds');
  P.x = MID + CAM.see + 40;
  run(12, tick);
  assert.equal(G.heat, 0, 'out of view it cools as before');
});
