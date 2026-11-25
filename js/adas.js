// SPDX-License-Identifier: GPL-2.0-or-later
// Cursed driver assistance. Some cars come with lane assist that grabs the wheel now and then, emergency braking
// that stops for people and cars on the move (and for things standing still, sometimes), or an anti-theft device
// that, a while after the car is stolen, stops it for good and sets off its alarm. They work only while the player
// drives: the city's own drivers switched them off long ago. The numbers are ADAS in js/config.js.
import { ADAS, ALARM_SAYS, HIT, KIND } from './config.js';
import { R, hyp, pick } from './util.js';
import { sfx } from './audio.js';
import { G, msg, ppos } from './state.js';
import { carHits } from './cars.js';

const between = ([a, b]) => a + R() * (b - a);
const lane = () => ({ next: between(ADAS.swerveEvery), left: 0, jerk: 0, dir: 0 });
// on: the way it is braking the car to a stop (1 forward, -1 reversing), or 0; latch: the way the gas stays off
// after it has stopped the car, until the player lets go of it and presses again.
const aeb = () => ({ on: 0, latch: 0, released: false, told: false, seen: null, sees: false, forget: 0 });
const theft = () => ({ left: between(ADAS.stealAfter), tripped: false });

/**
 * Fit a new car with what it has, each by its share, sports cars more often. Never the job's limo, and never a
 * police car: the police drive cars without any of it.
 */
export function fitAssists(c) {
  if (c.kind === KIND.limo || c.kind === KIND.police) return c;
  const k = c.kind === KIND.sports ? ADAS.sports : 1;
  if (R() < ADAS.lane * k) c.lane = lane();
  if (R() < ADAS.brake * k) c.aeb = aeb();
  if (R() < ADAS.theft * k) c.theft = theft();
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
 * How far emergency braking looks the way the car is going at `fwd`: ahead, at least `lookAhead` car lengths, or
 * as far as the car needs to stop if that is more; behind, reversing, `lookBehind` car lengths.
 */
export const lookout = (c, fwd) =>
  fwd >= 0 ? Math.max(ADAS.lookAhead * c.kind.L, stopping(c, fwd)) : ADAS.lookBehind * c.kind.L;
/**
 * What the car going at `fwd` (backwards if less than 0) would hit, within its lookout: { what, moving }, where
 * `what` is the person, the car or 'wall'; or null. Ahead, people count from where a car runs them over (HIT in
 * js/config.js); behind, from its back bumper.
 */
export function hazard(c, fwd) {
  const k = c.kind,
    way = fwd < 0 ? -1 : 1,
    fx = Math.cos(c.a) * way,
    fy = Math.sin(c.a) * way,
    reach = lookout(c, fwd),
    from = way > 0 ? 6 + HIT.nose : k.L / 2;
  for (const p of G.peds) {
    const dx = p.x - c.x,
      dy = p.y - c.y,
      along = dx * fx + dy * fy;
    if (along > 0 && along - from < reach && Math.abs(-dx * fy + dy * fx) < HIT.car + 1)
      return { what: p, moving: moving(p) };
  }
  // A car already against a wall (sliding along it) is not about to hit it.
  const walls = !carHits(c, c.x, c.y);
  for (let s = 2; s <= reach + 2; s += 3) {
    const x = c.x + fx * s,
      y = c.y + fy * s;
    if (walls && carHits(c, x, y)) return { what: 'wall', moving: false };
    // The corners and the middle of the bumper it is going towards.
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
 * Emergency braking: with something in the car's way within its lookout, ahead or reversing, brake hard to a full
 * stop, whatever the throttle and even if the way clears. Then the gas stays off that way until the player lets
 * go of it and presses it again; the other way works at once. Whether it sees something standing still is
 * decided once for each thing it comes up to.
 */
function emergencyBrake(c, b, fwd, thr, dt) {
  if (b.on) {
    // Braking to a stop: hard while it is going faster than a crawl, then the last of it rolls out.
    if (fwd * b.on > 5) return -b.on * ADAS.brakeHard;
    if (fwd * b.on > 0.5) return 0;
    b.latch = b.on;
    b.on = 0;
    b.released = false;
    b.told = false;
  }
  const h = Math.abs(fwd) > (fwd >= 0 ? ADAS.brakeFrom : ADAS.reverseFrom) ? hazard(c, fwd) : null;
  if (h) {
    if (h.what !== b.seen) {
      b.seen = h.what;
      b.sees = h.moving || R() < ADAS.brakeStill;
    }
    b.forget = 1;
  } else if ((b.forget -= dt) <= 0) b.seen = null;
  if (h && b.sees) {
    b.on = fwd < 0 ? -1 : 1;
    b.latch = 0;
    msg('EMERGENCY BRAKING ENGAGED');
    sfx.beeps();
    return -b.on * ADAS.brakeHard;
  }
  if (b.latch) {
    // The gas the way it stopped: off until let go of, then pressed again.
    const push = thr * b.latch;
    if (push <= 0) b.released = true;
    else if (b.released) b.latch = 0;
    else {
      if (!b.told) {
        b.told = true;
        msg('LIFT OFF THE GAS, THEN PRESS AGAIN');
      }
      return 0;
    }
  }
  return thr;
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

/**
 * A car's alarm, while it sounds: two notes in turn, quieter the further away, its lights flashing with them. A
 * while into it, the status line has a word on it, if the player can hear it.
 */
export function alarmStep(c, dt) {
  if (!(c.alarm > 0)) return;
  if (c.dead || c.flooded) {
    c.alarm = 0;
    c.alarmHi = false;
    return;
  }
  const p = ppos(),
    d = hyp(c.x - p.x, c.y - p.y),
    say = ADAS.alarmFor - ADAS.alarmSay,
    was = c.alarm;
  c.alarm -= dt;
  if (was > say && c.alarm <= say && d < ADAS.alarmHeard) msg(pick(ALARM_SAYS));
  if (c.alarm <= 0) {
    c.alarmHi = false;
    return;
  }
  if ((c.alarmT -= dt) > 0) return;
  c.alarmT = ADAS.alarmBeat;
  c.alarmHi = !c.alarmHi;
  if (d < ADAS.alarmHeard * 0.95) sfx.carAlarm(c.alarmHi, 1 - d / ADAS.alarmHeard);
}
