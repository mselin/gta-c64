// SPDX-License-Identifier: GPL-2.0-or-later
// Cursed driver assistance. Some cars come with lane assist that grabs the wheel now and then, emergency braking
// that stops for people and cars on the move (and for things standing still, sometimes), or an anti-theft device
// that, a while after the car is stolen, stops it for good and sets off its alarm. They work only while the player
// drives: the city's own drivers switched them off long ago. The numbers are ADAS in js/config.js.
import { ADAS, HIT, KIND } from './config.js';
import { R, hyp } from './util.js';
import { sfx } from './audio.js';
import { G, msg, ppos } from './state.js';
import { carHits } from './cars.js';

const between = ([a, b]) => a + R() * (b - a);
const lane = () => ({ next: between(ADAS.swerveEvery), left: 0, jerk: 0, dir: 0 });
const aeb = () => ({ on: false, hold: 0, seen: null, sees: false, forget: 0 });
const theft = () => ({ left: between(ADAS.stealAfter), tripped: false });

/**
 * Fit a new car with what it has, each by its share, sports cars more often. Never the job's limo, and never
 * anti-theft in a police car.
 */
export function fitAssists(c) {
  if (c.kind === KIND.limo) return c;
  const k = c.kind === KIND.sports ? ADAS.sports : 1;
  if (R() < ADAS.lane * k) c.lane = lane();
  if (R() < ADAS.brake * k) c.aeb = aeb();
  if (c.kind !== KIND.police && R() < ADAS.theft * k) c.theft = theft();
  return c;
}
/** Give a car each of `which` ('lane', 'aeb', 'theft'), fresh: for tests, and for trying them out. */
export function fit(c, ...which) {
  for (const w of which) c[w] = { lane, aeb, theft }[w]();
  return c;
}

/** Whether someone is on the move: walking, running or riding, not lying down, waiting or standing in a ring. */
const moving = (p) => p.spd > 0 && !(p.ko > 0) && !(p.wait > 0);
/** How far the car goes braking as hard as emergency braking does from `fwd`, with time to notice and a gap. */
export const stopping = (c, fwd) =>
  (fwd * fwd) / (2 * c.kind.acc * 2.2 * ADAS.brakeHard) + fwd * ADAS.react + ADAS.gap;
/** Another car whose body is at (x, y). */
function carAt(c, x, y) {
  for (const o of G.cars) {
    if (o === c || (o.flooded && o.sink >= 1)) continue;
    const dx = x - o.x,
      dy = y - o.y;
    if (Math.abs(dx) > 20 || Math.abs(dy) > 20) continue;
    const cs = Math.cos(o.a),
      sn = Math.sin(o.a);
    if (Math.abs(dx * cs + dy * sn) <= o.kind.L / 2 + 1 && Math.abs(-dx * sn + dy * cs) <= o.kind.W / 2 + 1)
      return o;
  }
  return null;
}
/**
 * What the car going forward at `fwd` would hit before it could stop: { what, moving }, where `what` is the
 * person, the car or 'wall'; or null. People count from where a car runs them over (HIT in js/config.js).
 */
export function hazard(c, fwd) {
  const k = c.kind,
    fx = Math.cos(c.a),
    fy = Math.sin(c.a),
    reach = stopping(c, fwd);
  for (const p of G.peds) {
    const dx = p.x - c.x,
      dy = p.y - c.y,
      along = dx * fx + dy * fy;
    if (along > 0 && along - 6 - HIT.nose < reach && Math.abs(-dx * fy + dy * fx) < HIT.car + 1)
      return { what: p, moving: moving(p) };
  }
  // A car already against a wall (sliding along it) is not about to hit it.
  const walls = !carHits(c, c.x, c.y);
  for (let s = 2; s <= reach + 2; s += 3) {
    const x = c.x + fx * s,
      y = c.y + fy * s;
    if (walls && carHits(c, x, y)) return { what: 'wall', moving: false };
    // The front corners and the middle of the bumper.
    for (let t = -1; t <= 1; t++) {
      const o = carAt(c, x + fx * (k.L / 2) - fy * (k.W / 2) * t, y + fy * (k.L / 2) + fx * (k.W / 2) * t);
      if (o) return { what: o, moving: hyp(o.vx, o.vy) > 10 };
    }
  }
  return null;
}

/** Lane assist: now and then at speed it takes the wheel, turning it hard this way and that, then gives it back. */
function laneAssist(l, fwd, steer, dt) {
  if (l.left > 0) {
    l.left -= dt;
    l.jerk -= dt;
    if (l.jerk <= 0) {
      l.jerk = ADAS.swerveJerk;
      if (R() < ADAS.flip) l.dir = -l.dir;
    }
    return l.dir;
  }
  if (fwd < ADAS.swerveFrom || (l.next -= dt) > 0) return steer;
  l.next = between(ADAS.swerveEvery);
  l.left = ADAS.swerveFor;
  l.jerk = ADAS.swerveJerk;
  l.dir = R() < 0.5 ? -1 : 1;
  msg('CURSED LANE ASSIST TOOK OVER');
  sfx.chime();
  return l.dir;
}

/**
 * Emergency braking: with something ahead nearer than the car can stop, brake hard until it is clear or the car
 * has stopped. Whether it sees something standing still is decided once for each thing it comes up to.
 */
function emergencyBrake(c, b, fwd, thr, dt) {
  const h = fwd > (b.on ? 5 : ADAS.brakeFrom) ? hazard(c, fwd) : null;
  if (h) {
    if (h.what !== b.seen) {
      b.seen = h.what;
      b.sees = h.moving || R() < ADAS.brakeStill;
    }
    b.forget = 1;
  } else if ((b.forget -= dt) <= 0) b.seen = null;
  if (h && b.sees) {
    if (!b.on) {
      b.on = true;
      msg('EMERGENCY BRAKING ENGAGED');
      sfx.beeps();
    }
    b.hold = 0.3;
  } else if (b.on && ((b.hold -= dt) <= 0 || fwd <= 5)) b.on = false;
  return b.on && fwd > 5 ? -ADAS.brakeHard : thr;
}

/** Anti-theft goes off: the car stops for good, and the alarm sounds. */
function trip(c) {
  c.theft.tripped = true;
  c.alarm = ADAS.alarmFor;
  c.alarmT = 0;
  msg('ANTI-THEFT ENGAGED: ENGINE IMMOBILISED');
}
/** Whether anti-theft has stopped this car for good. */
export const immobilised = (c) => !!(c && c.theft && c.theft.tripped);

/**
 * The player's throttle and steering, after the car's assistance has had its say: { thr, steer }. Called each
 * frame the player drives the car, and only then.
 */
export function assist(c, thr, steer, dt) {
  const fwd = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
  if (c.theft && !c.theft.tripped && (c.theft.left -= dt) <= 0) trip(c);
  // Stopped for good: no engine, and the brakes on.
  if (immobilised(c)) thr = fwd > 5 ? -1 : 0;
  if (c.lane) steer = laneAssist(c.lane, fwd, steer, dt);
  if (c.aeb) thr = emergencyBrake(c, c.aeb, fwd, thr, dt);
  return { thr, steer };
}

/** A car's alarm, while it sounds: two notes in turn, quieter the further away, its lights flashing with them. */
export function alarmStep(c, dt) {
  if (!(c.alarm > 0)) return;
  if (c.dead || c.flooded) {
    c.alarm = 0;
    c.alarmHi = false;
    return;
  }
  c.alarm -= dt;
  if (c.alarm <= 0) {
    c.alarmHi = false;
    return;
  }
  if ((c.alarmT -= dt) > 0) return;
  c.alarmT = ADAS.alarmBeat;
  c.alarmHi = !c.alarmHi;
  const p = ppos(),
    d = hyp(c.x - p.x, c.y - p.y);
  if (d < ADAS.alarmHeard * 0.95) sfx.carAlarm(c.alarmHi, 1 - d / ADAS.alarmHeard);
}
