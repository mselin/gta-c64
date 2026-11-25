// SPDX-License-Identifier: GPL-2.0-or-later
// GAGGLE cameras: the city's surveillance network, on poles at a scattering of crossings. A crime one sees counts
// for more and brings the next police car at once, and while one sees the player with heat, the heat does not
// cool. They report speeding and driving fast on the pavement too. Ramming or shooting one sets off its alarm,
// which reports the tampering, and then it goes dark until the city puts it back up. The numbers are CAM in
// js/config.js.
import { BLK, CAM, CAM_DOWN, CAM_SEEN, CAM_TAMPER, NB, PLAZA, WALK } from './config.js';
import { R, hyp, pick } from './util.js';
import { tileAt, wallAt } from './world.js';
import { sfx } from './audio.js';
import { G, P, msg, onScreen, ppos } from './state.js';
import { hurry } from './spawner.js';
import { crime } from './heat.js';

/**
 * Where the cameras stand: on the pavement at a corner of each crossing where (3 × avenue + 2 × street) is a
 * multiple of CAM.every, the first corner, going round, that is pavement or plaza.
 */
export function camSpots() {
  const spots = [];
  for (let i = 0; i <= NB; i++)
    for (let j = 0; j <= NB; j++) {
      if ((3 * i + 2 * j) % CAM.every) continue;
      const cx = i * BLK + 16,
        cy = j * BLK + 16;
      for (const [u, v] of [
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ]) {
        const x = cx + 22 * u,
          y = cy + 22 * v,
          t = tileAt(x, y);
        if (t === WALK || t === PLAZA) {
          spots.push({ x, y });
          break;
        }
      }
    }
  return spots;
}
/**
 * A working camera at (x, y): `alarm` seconds of alarm left (`hi` its high note), `dead` once put out of action,
 * `fixT` until it is put back up, `flash` seconds of its light flashing after a report, `saw` when it last
 * reported reckless driving (G.clock).
 */
export const mkCam = (x, y) => ({
  x,
  y,
  alarm: 0,
  alarmT: 0,
  hi: false,
  dead: false,
  fixT: 0,
  flash: 0,
  saw: -99,
});
/** Put the cameras up, all working, for a new game. */
export function placeCams() {
  G.cams = camSpots().map(({ x, y }) => mkCam(x, y));
}

/** Whether a working camera can see (x, y): near enough, and no building in the way. */
export function sees(cam, x, y) {
  if (cam.dead || cam.alarm > 0) return false;
  const dx = x - cam.x,
    dy = y - cam.y,
    d = hyp(dx, dy);
  if (d > CAM.see) return false;
  for (let s = 4; s < d; s += 4) if (wallAt(cam.x + (dx * s) / d, cam.y + (dy * s) / d)) return false;
  return true;
}
/** The first working camera that sees (x, y), or null. */
export const seenBy = (x, y) => G.cams.find((c) => sees(c, x, y)) || null;

/**
 * A crime of `n` where `cam` saw it: how much more it counts. The camera's light flashes, the next police car
 * comes at once, and the status line says so, now and then.
 */
export function reported(cam, n) {
  cam.flash = 1;
  hurry();
  if (G.clock - G.camSaid > CAM.sayGap) {
    G.camSaid = G.clock;
    msg(pick(CAM_SEEN));
  }
  return n * CAM.boost;
}

/** The player rams or shoots a camera: its alarm, which reports it, and then it goes dark. */
export function tamper(cam) {
  if (cam.dead || cam.alarm > 0) return;
  cam.alarm = CAM.alarm;
  cam.alarmT = 0;
  for (let i = 0; i < 6; i++)
    G.parts.push({
      x: cam.x,
      y: cam.y - 6,
      vx: (R() - 0.5) * 70,
      vy: (R() - 0.5) * 70 - 20,
      l: 0.35,
      col: 7,
    });
  crime(CAM.tamper);
  hurry();
  msg(pick(CAM_TAMPER));
}

/** Whether the point (x, y) is inside the player's car, with `r` to spare. */
function inCar(c, x, y, r) {
  const dx = x - c.x,
    dy = y - c.y,
    cs = Math.cos(c.a),
    sn = Math.sin(c.a);
  return Math.abs(dx * cs + dy * sn) <= c.kind.L / 2 + r && Math.abs(-dx * sn + dy * cs) <= c.kind.W / 2 + r;
}

/** Each frame: alarms, repairs, the player's car against them, reckless driving in view, and watching. */
export function updCams(dt) {
  const p = ppos(),
    c = P.car,
    v = c ? hyp(c.vx, c.vy) : 0;
  for (const cam of G.cams) {
    cam.flash -= dt;
    if (cam.dead) {
      // Put back up a while later, once nobody is looking.
      if ((cam.fixT -= dt) <= 0 && !onScreen(cam.x, cam.y, 40)) cam.dead = false;
      continue;
    }
    if (cam.alarm > 0) {
      cam.alarm -= dt;
      if (cam.alarm <= 0) {
        cam.dead = true;
        cam.hi = false;
        cam.fixT = CAM.fix;
        msg(pick(CAM_DOWN));
        continue;
      }
      if ((cam.alarmT -= dt) <= 0) {
        cam.alarmT = CAM.beat;
        cam.hi = !cam.hi;
        const d = hyp(cam.x - p.x, cam.y - p.y);
        if (d < CAM.heard * 0.95) sfx.camAlarm(cam.hi, 1 - d / CAM.heard);
      }
      continue;
    }
    if (G.screen !== 'play' || !c) continue;
    if (v > CAM.knock && inCar(c, cam.x, cam.y, 1.5)) tamper(cam);
  }
  if (G.screen !== 'play') return;
  // Reckless driving where a camera can see it.
  if (c) {
    const t = tileAt(c.x, c.y),
      fast = v > CAM.speeding || ((t === WALK || t === PLAZA) && v > CAM.pavement),
      cam = fast && seenBy(c.x, c.y);
    if (cam && G.clock - cam.saw > CAM.again) {
      cam.saw = G.clock;
      crime(CAM.reckless);
    }
  }
  // While a camera sees the player with heat on them, the heat does not cool.
  if (G.heat > 0 && seenBy(p.x, p.y)) G.heatCool = 0;
}
