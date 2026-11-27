// SPDX-License-Identifier: GPL-2.0-or-later
// The player on foot and at the wheel: movement, weapons, getting in and out of cars, dying and getting arrested.
import { DIRS, HIT, JACK, KIND, KO, MELEE, ZOOM, PACE, PERSON } from './config.js';
import { angDiff, clamp, hyp, pick } from './util.js';
import { COPS, HOSP, footClear, waterAt, foot } from './world.js';
import { noise, sfx } from './audio.js';
import { G, K, P, bigText, edge, inBody, msg, onScreen, pop, touch, weapon, carBodyAt } from './state.js';
import { mkPed } from './entities.js';
import { crime, policeNear } from './heat.js';
import { carPhys, sidePos } from './cars.js';
import { killPed, knockDown, scare } from './peds.js';
import { failJob } from './missions.js';
import { radio } from './radio.js';
import { ARM_OUT_T, PUNCH, SHOOT, STAB } from './figures.js';
import { assist, immobilised } from './adas.js';

/** Put the player's own bookkeeping back to how a new game starts (resetGame in game.js). */
export function resetPlayer() {
  downKind = '';
  seized = false;
  skidT = 0;
}
let downKind = '';
let seized = false; // the police took the player's weapons when they last went down
let skidT = 0;
/** The player loses `n` health; `cop`: an officer's shot did it. */
export function hurt(n, why, cop = false) {
  if (G.screen !== 'play') return;
  P.hp -= n;
  P.hitT = 0.4;
  if (P.hp <= 0) {
    P.hp = 0;
    down('dead', why, cop);
  }
}
/** How the player last went down: 'dead' or 'busted'. */
export const lastDown = () => downKind;
/**
 * The player is wasted ('dead') or busted. The police take the knife and all the ammo when they bust the player,
 * and when the player is wasted with the police about (policeNear) or by an officer's shot (`cop`). Wasted with
 * no police about, the player keeps both.
 */
export function down(kind, why, cop = false) {
  // Before the car is let go: the police are looked for round where the player is, in it or on foot.
  seized = kind === 'busted' || cop || policeNear();
  if (seized) {
    P.knife = false;
    P.ammo = 0;
  }
  G.screen = 'down';
  downKind = kind;
  G.downT = 3.2;
  if (P.car) {
    P.car.driver = false;
    P.car = null;
  }
  if (kind === 'dead') {
    bigText('FLATLINED', why || 'THOUGHTS AND PRAYERS HAVE BEEN DISPATCHED', 2, 3.2);
    sfx.bad();
  } else {
    bigText('BUSTED', why || 'YOU HAVE THE RIGHT TO REMAIN BROKE', 14, 3.2);
    sfx.bad();
  }
  if (G.job) failJob(null);
}
export function respawn() {
  // Arrested with nothing left to confiscate: the game ends here.
  if (downKind === 'busted' && G.cash === 0) {
    G.screen = 'over';
    G.banner = null;
    return;
  }
  const L = downKind === 'dead' ? HOSP : COPS;
  P.x = L.x;
  P.y = L.y;
  P.hp = 100;
  P.car = null;
  G.heat = 0;
  G.heatPts = 0;
  G.cars = G.cars.filter((c) => c.ai !== 'cop');
  G.peds = G.peds.filter((p) => p.type !== 'cop');
  G.heli = null;
  G.bullets = [];
  G.screen = 'play';
  if (downKind === 'dead') {
    const bill = Math.min(G.cash, 500);
    G.cash -= bill;
    msg(
      'ST. INVOICE HOSPITAL: AMBULANCE RIDE -$' +
        bill +
        ' (OUT OF NETWORK)' +
        (seized ? '. THE POLICE KEPT YOUR WEAPONS AS "EVIDENCE"' : ''),
    );
  } else {
    const f = Math.floor(G.cash * 0.2);
    G.cash -= f;
    msg('CIVIL ASSET FORFEITURE: -$' + f + '. YOUR WEAPONS ARE NOW "EVIDENCE"');
  }
}
function enterCar() {
  let best = null,
    bd = 19;
  for (const c of G.cars) {
    if (c.dead || c.flooded) continue;
    const d = hyp(c.x - P.x, c.y - P.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  if (!best) return;
  const c = best;
  if (c.driver) {
    // The driver is thrown out at the door and lands on the ground, facing away from the car, as if knocked down:
    // they lie there KO.t seconds, then get up as anyone knocked down does. From a police car, a police officer.
    const s = sidePos(c) || { x: c.x, y: c.y },
      q = mkPed(s.x, s.y, c.kind === KIND.police ? 'cop' : 'civ'),
      out = hyp(s.x - c.x, s.y - c.y) || 1;
    q.dx = (s.x - c.x) / out;
    q.dy = (s.y - c.y) / out;
    q.ko = KO.t;
    G.peds.push(q);
    scare(q.x, q.y, 60, 2);
    if (onScreen(q.x, q.y, 0)) pop(q.x, q.y - 8, 'OOF', 10);
    crime(c.kind === KIND.police ? 16 : 4);
    msg(c.kind === KIND.police ? 'OFFICER: "THAT IS A COMPANY CAR!"' : pick(JACK));
  }
  c.vx = c.ai === 'traffic' ? DIRS[c.dir][0] * c.sp : c.vx;
  c.vy = c.ai === 'traffic' ? DIRS[c.dir][1] * c.sp : c.vy;
  c.ai = null;
  c.driver = false;
  c.parked = false;
  c.used = true; // the player's own: it stays where they leave it
  P.car = c;
  sfx.door();
  if (immobilised(c)) msg('THE IMMOBILISER SAYS NO');
  if (G.musicOn) G.pops.push({ x: 0, y: 0, t: 'RADIO: ' + radio[G.station].name, col: 7, l: 2.5, hud: true });
}
function exitCar() {
  const c = P.car;
  if (hyp(c.vx, c.vy) > 45) return;
  const s = sidePos(c);
  if (!s) return;
  P.x = s.x;
  P.y = s.y;
  P.car = null;
  sfx.door();
}
/**
 * Whether the player on foot may step to (x, y): clear of walls and of cars' bodies. Someone caught in a wall may
 * still walk, or they could never leave it, and someone a car has stopped on may walk out from under it; each
 * only from what they are caught in, never through the other.
 */
function canStep(x, y) {
  const f = foot();
  return (!footClear(P.x, P.y) || footClear(x, y)) && (!!carBodyAt(P.x, P.y, f) || !carBodyAt(x, y, f));
}

// ---------- touch steering ----------
// On a touch screen the player holds a finger on the screen and the player character heads for it.
/**
 * How far a finger is from the player or the car, in city pixels, at the scale now. The player is drawn their
 * screen size, so how near them a finger is goes by PERSON; the car is drawn ZOOM times its size, so "on the car"
 * stays in city pixels; and a phone screen holds 1 / ZOOM as many city pixels, so flat out is nearer.
 */
export const touchReach = () => ({
  stand: 6 * PERSON, // a finger this close to the player means stand still
  brake: 16, // a finger on the car means stop
  flatOut: 16 + 34 / ZOOM, // a finger this far ahead or more means flat out (a phone screen is not tall)
});
const BEHIND = 2.3; // radians: further round than this, the finger is behind the car

/** The point in the city a held finger points at, or null. */
export const touchTarget = () =>
  touch.at ? { x: G.camX + touch.at.x / ZOOM, y: G.camY + touch.at.y / ZOOM } : null;

/** On foot: the direction to walk in to reach (tx, ty), as a unit vector, or null to stand still. */
export function walkToward(px, py, tx, ty) {
  const dx = tx - px,
    dy = ty - py,
    d = hyp(dx, dy);
  return d < touchReach().stand ? null : { dx: dx / d, dy: dy / d };
}

/**
 * In a car: throttle (-1 to 1) and steering (-1 to 1) that take the car towards (tx, ty).
 * Ahead: drive at it, faster the further away it is, easing off in tight turns.
 * Behind: brake, then reverse, swinging the tail round towards it. On the car itself: brake.
 */
export function driveToward(c, tx, ty) {
  const { brake, flatOut } = touchReach(),
    dx = tx - c.x,
    dy = ty - c.y,
    d = hyp(dx, dy),
    fwd = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
  if (d < brake) return { thr: fwd > 5 ? -1 : fwd < -5 ? 1 : 0, steer: 0 };
  const want = Math.atan2(dy, dx),
    diff = angDiff(want, c.a);
  if (Math.abs(diff) > BEHIND) {
    // Going forward still: brake in a straight line first.
    if (fwd > 5) return { thr: -1, steer: 0 };
    // Reversing turns the car the other way, so steer against the tail's error.
    return { thr: -1, steer: -clamp(angDiff(want + Math.PI, c.a) * 2, -1, 1) };
  }
  const push = clamp((d - brake) / (flatOut - brake), 0.3, 1);
  return { thr: Math.abs(diff) > 1.2 ? Math.min(push, 0.4) : push, steer: clamp(diff * 2.5, -1, 1) };
}

export function updPlayer(dt) {
  if (G.screen !== 'play') return;
  P.hitT -= dt;
  P.armT -= dt;
  const c = P.car;
  if (c) {
    const aim = touchTarget(),
      want = aim
        ? driveToward(c, aim.x, aim.y)
        : { thr: (K.up ? 1 : 0) - (K.down ? 1 : 0), steer: (K.right ? 1 : 0) - (K.left ? 1 : 0) },
      // The car's cursed assistance, if it has any, gets its say.
      ctl = assist(c, want.thr, want.steer, dt);
    carPhys(c, ctl.thr, ctl.steer, dt, !!K.hb);
    // A car that floods leaves the player swimming where it went down (flood in js/cars.js): it is not theirs any
    // more, so there is nothing left of it to steer, sound the horn of or get out of this frame.
    if (P.car !== c) return;
    if (c.sk) {
      skidT -= dt;
      if (skidT <= 0) {
        skidT = 0.08;
        noise(0.09, Math.min(0.2, 0.06 + c.slide / 600), 2600);
      }
    }
    P.x = c.x;
    P.y = c.y;
    P.a = c.a;
    if (edge.fire) {
      sfx.horn();
      scare(c.x, c.y, 60, 1.5);
    }
    if (edge.use) exitCar();
    if (c.burn > 0 && !c.warned) {
      c.warned = true;
      msg('YOUR CAR IS ON FIRE. THIS IS FINE.');
    }
  } else {
    // In the water the player swims: slowly, and with both hands busy.
    const swim = waterAt(P.x, P.y);
    if (swim && !P.swim) sfx.splash();
    P.swim = swim;
    let dx = (K.right ? 1 : 0) - (K.left ? 1 : 0),
      dy = (K.down ? 1 : 0) - (K.up ? 1 : 0);
    const aim = touchTarget();
    if (aim) {
      const way = walkToward(P.x, P.y, aim.x, aim.y);
      dx = way ? way.dx : 0;
      dy = way ? way.dy : 0;
    }
    if (dx || dy) {
      const l = hyp(dx, dy);
      dx /= l;
      dy /= l;
      P.a = Math.atan2(dy, dx);
      const s = (swim ? PACE.swim : PACE.walk) * dt;
      // Each way separately, so the player slides along a wall or a car (canStep: out of either, never into one).
      if (canStep(P.x + dx * s, P.y)) P.x += dx * s;
      if (canStep(P.x, P.y + dy * s)) P.y += dy * s;
      P.anim += dt * 9;
    } else P.anim = 0; // standing still: the middle pose
    P.cd -= dt;
    // Fire shoots, unless it is still held from the press that started the game.
    if (!K.fire) G.holdFire = false;
    if (K.fire && !G.holdFire && P.cd <= 0 && !swim) {
      const fx = Math.cos(P.a),
        fy = Math.sin(P.a);
      if (P.ammo > 0) {
        P.ammo--;
        P.cd = 0.22;
        P.arm = SHOOT;
        P.armT = ARM_OUT_T;
        G.bullets.push({ x: P.x + fx * 5, y: P.y + fy * 5, vx: fx * 240, vy: fy * 240, l: 0.55, own: 0 });
        sfx.shot();
        crime(1.5);
        scare(P.x, P.y, 110, 4);
      } else {
        // Out of ammo: a stab with the knife kills; a punch knocks someone down. Either passes over nobody
        // already down except a stab, which finishes the job.
        const knife = weapon() === 'knife',
          w = knife ? MELEE.knife : MELEE.fist,
          hx = P.x + fx * w.ahead,
          hy = P.y + fy * w.ahead;
        P.cd = w.cd;
        P.arm = knife ? STAB : PUNCH;
        P.armT = ARM_OUT_T;
        sfx.punch();
        for (const q of G.peds.slice())
          if ((knife || !(q.ko > 0)) && hyp(q.x - hx, q.y - hy) < w.r) {
            if (knife) killPed(q, true, P);
            else knockDown(q);
            break;
          }
      }
    }
    if (edge.use) enterCar();
    for (const o of G.cars) {
      const sp = hyp(o.vx, o.vy);
      if (sp > 45 && P.hitT <= 0 && inBody(o, P.x, P.y, HIT.body)) {
        hurt(sp * 0.28, 'A PEDESTRIAN. IN THIS ECONOMY?');
        sfx.squish();
        const nx = P.x + o.vx * 0.06,
          ny = P.y + o.vy * 0.06;
        if (footClear(nx, ny)) {
          P.x = nx;
          P.y = ny;
        }
      }
    }
  }
}
