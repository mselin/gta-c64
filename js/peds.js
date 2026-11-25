// SPDX-License-Identifier: GPL-2.0-or-later
// Pedestrians and police on foot, and Big Honk.
import {
  DIRS,
  GRASS,
  HIT,
  HONK,
  KNIFE,
  KO,
  LOT,
  PAL,
  PLAZA,
  ROAD,
  WALK,
  WATER,
  PACE,
  PERSON,
} from './config.js';
import { R, hyp } from './util.js';
import { decals, nearestLand, solidAt, tileAt, wallAt, waterAt, foot } from './world.js';
import { sfx } from './audio.js';
import { G, P, msg, onScreen, pop, ppos, carBodyAt } from './state.js';
import { crime } from './heat.js';
import { down } from './player.js';
import { ARM_OUT_T, SHOOT } from './figures.js';

let immunity = false;
export function resetPeds() {
  immunity = false;
}
/** Leave a mark on the ground where someone died. */
function stain(p) {
  // Sized to the person as drawn, about 10 screen pixels across: 10 × PERSON city pixels, as the stain is
  // painted into the city's map.
  const r = 12 * PERSON,
    w = Math.max(2, Math.round(5 * PERSON)),
    h = Math.max(2, Math.round(6 * PERSON));
  decals.ctx.fillStyle = PAL[2];
  for (let k = 0; k < Math.round(18 * PERSON); k++)
    decals.ctx.fillRect(Math.floor(p.x + (R() - 0.5) * r), Math.floor(p.y + (R() - 0.5) * r), 1, 1);
  decals.ctx.fillStyle = PAL[p.shirt];
  decals.ctx.fillRect(Math.floor(p.x - w / 2), Math.floor(p.y - h / 2), w, h);
}
/**
 * Someone is killed: shot, punched, run over or caught in a blast, by the player or not. `from` is where it
 * came from. Big Honk is the exception: nothing hurts him, it only ruffles him.
 */
export function killPed(p, byPlayer, from = null) {
  if (p.type === 'honk') {
    ruffle(p, from);
    return;
  }
  const i = G.peds.indexOf(p);
  if (i < 0) return;
  G.peds.splice(i, 1);
  if (!waterAt(p.x, p.y)) stain(p);
  if (onScreen(p.x, p.y, 10)) sfx.squish();
  if (byPlayer) {
    crime(p.type === 'cop' ? 28 : 6);
    if (G.job && G.job.def.type === 'kill' && p.type === 'scoot') {
      G.job.n++;
      pop(p.x, p.y - 8, G.job.n + '/' + G.job.def.n, 7);
    } else if (p.type === 'scoot') pop(p.x, p.y - 8, '+$0 (PUBLIC SERVICE)', 13);
    else {
      const r = R();
      if (r < 0.4)
        G.pickups.push({ x: p.x, y: p.y, type: 'cash', v: 10 + Math.floor(R() * 9) * 10, temp: 20, t: 0 });
      else if (!P.knife && r < 0.4 + KNIFE.drop)
        G.pickups.push({ x: p.x, y: p.y, type: 'knife', temp: 20, t: 0 });
    }
  }
}
/**
 * A punch: down on their back for KO.t seconds, then up and away. Half the heat of a kill. Big Honk cannot be
 * knocked down: a punch from the player only ruffles him.
 */
export function knockDown(p) {
  if (p.type === 'honk') {
    ruffle(p, P);
    return;
  }
  p.ko = KO.t;
  p.armT = 0;
  crime(p.type === 'cop' ? KO.copCrime : KO.crime);
  scare(p.x, p.y, 60, 2);
  if (onScreen(p.x, p.y, 0)) pop(p.x, p.y - 8, 'OOF', 10);
}
/** Back on their feet: a passer-by runs from the player; the police carry on where they left off. */
function getUp(p) {
  if (p.type === 'cop' || p.type === 'cult') return;
  const pl = ppos();
  p.flee = 3 + R() * 2;
  p.fx = pl.x;
  p.fy = pl.y;
}
export function scare(x, y, r, t) {
  for (const q of G.peds)
    if (q.type !== 'cop' && q.type !== 'honk' && hyp(q.x - x, q.y - y) < r) {
      q.flee = t;
      q.fx = x;
      q.fy = y;
    }
}
export const SWIM_FACTOR = 0.4;
/**
 * Someone part way round a car: on along the side they chose while the way they want to go, (vx, vy), still runs
 * into it. False once that way is clear, or the side is blocked, or it has taken too long: they go on as usual.
 */
function stepRound(p, vx, vy, dt) {
  const f = foot(),
    sp = hyp(vx, vy),
    look = 4 * PERSON + f;
  p.round.t -= dt;
  if (!sp || p.round.t <= 0 || !carBodyAt(p.x + (vx / sp) * look, p.y + (vy / sp) * look, f)) {
    p.round = null;
    return false;
  }
  const sx = p.x + p.round.dx * sp * dt,
    sy = p.y + p.round.dy * sp * dt;
  if (wallAt(sx, sy) || carBodyAt(sx, sy, f)) {
    p.round = null;
    return false;
  }
  p.x = sx;
  p.y = sy;
  return true;
}
function pedMove(p, vx, vy, dt) {
  // Water is not a wall for people, but it is slow going.
  if (waterAt(p.x, p.y)) {
    vx *= SWIM_FACTOR;
    vy *= SWIM_FACTOR;
  }
  if (p.round && stepRound(p, vx, vy, dt)) return true;
  const nx = p.x + vx * dt,
    ny = p.y + vy * dt,
    // Someone a car has stopped on may walk out; nobody walks into one.
    f = foot(),
    caught = carBodyAt(p.x, p.y, f),
    clear = (x, y) => !wallAt(x, y) && (caught || !carBodyAt(x, y, f)),
    x0 = p.x,
    y0 = p.y;
  if (clear(nx, p.y)) p.x = nx;
  if (clear(p.x, ny)) p.y = ny;
  const want = hyp(vx, vy) * dt,
    got = hyp(p.x - x0, p.y - y0);
  if (want > 0 && got < want * 0.2 && !caught) {
    // Barely moved, and a car is what is in the way: step round it, sideways, away from its middle, and keep on
    // that side until the way ahead is clear of it (stepRound).
    const car = carBodyAt(nx, ny, f) || carBodyAt(nx, p.y, f) || carBodyAt(p.x, ny, f);
    if (car) {
      p.x = x0;
      p.y = y0;
      const ux = -vy / hyp(vx, vy),
        uy = vx / hyp(vx, vy),
        away = ux * (p.x - car.x) + uy * (p.y - car.y) >= 0 ? 1 : -1;
      const side = [away, -away].find((k) => clear(p.x + ux * k * want, p.y + uy * k * want));
      if (side) {
        p.round = { dx: ux * side, dy: uy * side, t: ROUND_CAR.most };
        p.x += ux * side * want;
        p.y += uy * side * want;
        return true;
      }
    }
  }
  return got > 0;
}
/** How long someone stands at a car in their way before stepping round it, and at most how long the step takes. */
export const ROUND_CAR = { wait: 0.4, most: 3 };
/**
 * A passer-by or a scooter walking their way (dx, dy): stopped by walls, and by cars. At a car in the way they
 * stop just short of it, wait a moment, then step sideways, away from its middle, until their way is clear, and
 * carry on. With no way round, they turn back.
 */
function walkOn(p, dt) {
  const f = foot(),
    look = 4 * PERSON + f,
    step = p.spd * dt,
    caught = carBodyAt(p.x, p.y, f);
  if (p.round) {
    // Stepping round a car: until the way ahead is clear of it, or it takes too long.
    p.round.t -= dt;
    const sx = p.x + p.round.dx * step,
      sy = p.y + p.round.dy * step;
    if (!carBodyAt(p.x + p.dx * look, p.y + p.dy * look, f) || p.round.t <= 0) p.round = null;
    else if (!solidAt(sx, sy) && (caught || !carBodyAt(sx, sy, f))) {
      p.x = sx;
      p.y = sy;
      return;
    } else {
      p.round = null;
      pedPick(p); // hemmed in: try another way
      return;
    }
  }
  const car = caught ? null : carBodyAt(p.x + p.dx * look, p.y + p.dy * look, f);
  if (car) {
    p.wait = (p.wait || 0) + dt;
    if (p.wait < ROUND_CAR.wait) return; // stop near the car first
    p.wait = 0;
    // The side away from the car's middle, if it is clear; else the other side; else turn back.
    const sides = [
      [-p.dy, p.dx],
      [p.dy, -p.dx],
    ].sort(
      (a, b) => b[0] * (p.x - car.x) + b[1] * (p.y - car.y) - (a[0] * (p.x - car.x) + a[1] * (p.y - car.y)),
    );
    const way = sides.find(
      ([dx, dy]) =>
        !solidAt(p.x + dx * look, p.y + dy * look) && !carBodyAt(p.x + dx * look, p.y + dy * look, f),
    );
    if (way) p.round = { dx: way[0], dy: way[1], t: ROUND_CAR.most };
    else pedPick(p);
    return;
  }
  p.wait = 0;
  if (!solidAt(p.x + p.dx * 4, p.y + p.dy * 4)) {
    p.x += p.dx * step;
    p.y += p.dy * step;
  }
}
function pedPref(t, p) {
  return t === WALK || t === PLAZA || t === GRASS || (p.jay && (t === ROAD || t === LOT));
}
function pedPick(p) {
  const here = tileAt(p.x, p.y);
  p.jay = here === ROAD || here === LOT || R() < 0.1;
  const o = [0, 1, 2, 3].sort(() => R() - 0.5);
  let ch = null;
  for (const i of o) {
    const d = DIRS[i];
    if (d[0] === -p.dx && d[1] === -p.dy && R() < 0.8) continue;
    if (pedPref(tileAt(p.x + d[0] * 9, p.y + d[1] * 9), p)) {
      ch = d;
      break;
    }
  }
  if (!ch)
    for (const i of o) {
      const d = DIRS[i];
      if (!solidAt(p.x + d[0] * 9, p.y + d[1] * 9)) {
        ch = d;
        p.jay = true;
        break;
      }
    }
  if (ch) {
    p.dx = ch[0];
    p.dy = ch[1];
  }
  p.t = 1 + R() * 5;
}
/**
 * What would hurt anyone else only ruffles Big Honk: he flaps his wings, honks, and runs off away from it,
 * flapping, for HONK.flapT seconds, during which nothing ruffles him again.
 */
function ruffle(p, from) {
  if (p.flap > 0) return;
  p.flap = HONK.flapT;
  p.fx = from ? from.x : p.x - p.dx;
  p.fy = from ? from.y : p.y - p.dy;
  if (onScreen(p.x, p.y, 10)) {
    sfx.honk();
    pop(p.x, p.y - 12, 'HONK!', 7);
  }
}
/**
 * Whether Big Honk will head a way: onto a bank, the water or grass ahead, and not off The Moat. Sometimes
 * (jay) a road too: he crosses the bridges, and so gets up and down the whole canal.
 */
function honkWants(p, dx, dy) {
  const x = p.x + dx * 9,
    t = tileAt(x, p.y + dy * 9);
  return (
    x >= HONK.x0 &&
    x < HONK.x1 &&
    (t === WALK || t === WATER || t === GRASS || t === PLAZA || (p.jay && t === ROAD))
  );
}
function honkPick(p) {
  p.jay = R() < HONK.jay;
  const o = [0, 1, 2, 3].sort(() => R() - 0.5);
  let ch = o
    .map((i) => DIRS[i])
    .find((d) => !(d[0] === -p.dx && d[1] === -p.dy && R() < 0.8) && honkWants(p, d[0], d[1]));
  // Nothing he likes: anywhere he can go on The Moat, a bridge's road included.
  ch ??= o
    .map((i) => DIRS[i])
    .find((d) => {
      const x = p.x + d[0] * 9;
      return x >= HONK.x0 && x < HONK.x1 && !solidAt(x, p.y + d[1] * 9);
    });
  if (ch) {
    p.dx = ch[0];
    p.dy = ch[1];
  }
  p.t = 1 + R() * 5;
}
/** Move Big Honk, never off The Moat or into a wall. A goose swims as fast as he walks. */
function honkMove(p, vx, vy, dt) {
  const nx = p.x + vx * dt,
    ny = p.y + vy * dt;
  if (nx >= HONK.x0 && nx < HONK.x1 && !wallAt(nx, p.y)) p.x = nx;
  if (!wallAt(p.x, ny)) p.y = ny;
  p.swim = waterAt(p.x, p.y);
}
/** Big Honk wanders the banks of The Moat and paddles in it, as he pleases; ruffled, he runs off flapping. */
function updHonk(p, dt) {
  if (p.flap > 0) {
    p.flap -= dt;
    const dx = p.x - p.fx,
      dy = p.y - p.fy,
      d = hyp(dx, dy) || 1;
    honkMove(p, (dx / d) * HONK.run, (dy / d) * HONK.run, dt);
    return;
  }
  p.t -= dt;
  if (p.t <= 0 || !honkWants(p, p.dx, p.dy)) honkPick(p);
  honkMove(p, p.dx * p.spd, p.dy * p.spd, dt);
}
export function updPeds(dt) {
  const pl = ppos();
  for (const p of G.peds.slice()) {
    p.anim += dt * p.spd * 0.15;
    p.armT -= dt;
    if (p.ko > 0) {
      p.ko -= dt;
      if (p.ko <= 0) getUp(p);
      continue;
    }
    if (p.type === 'cult') continue; // deep in ceremony: nothing moves them
    if (p.type === 'honk') {
      updHonk(p, dt);
      continue;
    }
    if (p.type === 'cop' && G.heat > 0 && G.screen === 'play') {
      const dx = pl.x - p.x,
        dy = pl.y - p.y,
        d = hyp(dx, dy) || 1;
      p.dx = dx / d;
      p.dy = dy / d;
      if (d > 6 * PERSON) pedMove(p, p.dx * p.spd, p.dy * p.spd, dt);
      p.cd -= dt;
      // An officer swimming, in the canal or a fountain pool, has no hand free to shoot with, as the player has not.
      if (G.heat >= 3 && d < 95 && p.cd <= 0 && !waterAt(p.x, p.y)) {
        p.cd = 1.1 + R() * 0.6;
        p.arm = SHOOT;
        p.armT = ARM_OUT_T;
        G.bullets.push({
          x: p.x,
          y: p.y,
          vx: p.dx * 200 + (R() - 0.5) * 40,
          vy: p.dy * 200 + (R() - 0.5) * 40,
          l: 0.6,
          own: 1,
        });
        if (onScreen(p.x, p.y, 0)) sfx.shot();
      }
      if (!P.car && d < 7 * PERSON) down('busted');
      else if (P.car && d < 13 && hyp(P.car.vx, P.car.vy) < 22) {
        P.car.bust += dt;
        if (P.car.bust > 0.7) {
          P.car.bust = 0;
          down('busted', 'PLEASE STEP OUT OF THE STOLEN VEHICLE');
        }
      }
      continue;
    }
    if (p.flee > 0) {
      p.flee -= dt;
      const dx = p.x - p.fx,
        dy = p.y - p.fy,
        d = hyp(dx, dy) || 1;
      p.dx = dx / d;
      p.dy = dy / d;
      if (!pedMove(p, p.dx * PACE.flee, p.dy * PACE.flee, dt)) {
        p.fx = p.x + (R() - 0.5) * 20;
        p.fy = p.y + (R() - 0.5) * 20;
      }
      if (p.flee <= 0) {
        p.dx = 1;
        p.dy = 0;
        pedPick(p);
      }
      continue;
    }
    if (waterAt(p.x, p.y)) {
      // Nobody is in the water on purpose: head for the nearest bank, slowly.
      p.landT = (p.landT || 0) - dt;
      if (!p.land || p.landT <= 0) {
        p.land = nearestLand(p.x, p.y);
        p.landT = 1;
      }
      if (p.land) {
        const dx = p.land.x - p.x,
          dy = p.land.y - p.y,
          d = hyp(dx, dy) || 1;
        p.dx = dx / d;
        p.dy = dy / d;
        pedMove(p, p.dx * PACE.wade, p.dy * PACE.wade, dt);
      }
      p.t = 0;
      continue;
    }
    p.land = null;
    p.t -= dt;
    if (!p.round && (p.t <= 0 || !pedPref(tileAt(p.x + p.dx * 9, p.y + p.dy * 9), p))) pedPick(p);
    walkOn(p, dt);
  }
  // run over
  for (const c of G.cars) {
    const sp = hyp(c.vx, c.vy);
    if (sp < 30) continue;
    const fx = c.x + Math.cos(c.a) * 6,
      fy = c.y + Math.sin(c.a) * 6;
    for (const p of G.peds.slice())
      if (hyp(p.x - c.x, p.y - c.y) < HIT.car || hyp(p.x - fx, p.y - fy) < HIT.nose) {
        const mine = c === P.car;
        killPed(p, mine, c);
        if (c.ai === 'cop' && !immunity) {
          immunity = true;
          msg('POLICE STATEMENT: "THE PEDESTRIAN WAS RESISTING."');
        }
      }
  }
}
