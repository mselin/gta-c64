// SPDX-License-Identifier: GPL-2.0-or-later
// The police helicopter. At heat 5 it comes and follows the player wherever they go, over buildings, water and all,
// faster than any car, so it cannot be shaken off. It never lands and does nothing to the player: it lights them
// up, and while it is overhead the heat does not cool. Once the heat is below 5 (the paint shop, say) it flies off.
import { HELI, PI } from './config.js';
import { R, hyp } from './util.js';
import { G, msg, onScreen, ppos } from './state.js';
import { noise } from './audio.js';

export function updHeli(dt) {
  const p = ppos();
  if (!G.heli) {
    if (G.screen !== 'play' || G.heat < HELI.heat) return;
    // It comes in from out of sight, from any side.
    const a = R() * PI * 2;
    G.heli = {
      x: p.x + Math.cos(a) * HELI.from,
      y: p.y + Math.sin(a) * HELI.from,
      vx: 0,
      vy: 0,
      a,
      t: 0,
      chop: 0,
      seen: false,
    };
  }
  const h = G.heli;
  h.t += dt;
  // Its line once it comes into view, so it does not cut the heat's own announcement short.
  if (!h.seen && onScreen(h.x, h.y, -8)) {
    h.seen = true;
    msg('POLICE HELICOPTER OVERHEAD. SMILE, YOU ARE ON THE EVENING NEWS.');
  }
  h.leaving = G.heat < HELI.heat;
  let tx, ty;
  if (h.leaving) {
    // Away from the player, the way it is facing, until it is well out of sight.
    tx = h.x + Math.cos(h.a) * 100;
    ty = h.y + Math.sin(h.a) * 100;
    if (hyp(h.x - p.x, h.y - p.y) > HELI.gone) {
      G.heli = null;
      return;
    }
  } else {
    // Over the player, drifting round them a little as a hovering helicopter does.
    tx = p.x + Math.cos(h.t * 0.7) * HELI.orbit;
    ty = p.y + Math.sin(h.t * 0.9) * HELI.orbit;
  }
  // How fast the player is going, from where they were a moment ago: the helicopter matches it, so it keeps up.
  const pvx = h.px == null || h.leaving ? 0 : (p.x - h.px) / dt,
    pvy = h.py == null || h.leaving ? 0 : (p.y - h.py) / dt;
  h.px = p.x;
  h.py = p.y;
  // It wants to go as fast as the player and close the gap in about half a second on top of that, no faster than
  // its top speed, and gets there by accelerating.
  let wx = pvx + (tx - h.x) * 2,
    wy = pvy + (ty - h.y) * 2;
  const w = hyp(wx, wy);
  if (w > HELI.spd) {
    wx *= HELI.spd / w;
    wy *= HELI.spd / w;
  }
  const dvx = wx - h.vx,
    dvy = wy - h.vy,
    dv = hyp(dvx, dvy),
    step = Math.min(dv, HELI.acc * dt);
  if (dv > 0) {
    h.vx += (dvx / dv) * step;
    h.vy += (dvy / dv) * step;
  }
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  // It turns to face where it is going, once it is going anywhere.
  if (hyp(h.vx, h.vy) > 20) h.a = Math.atan2(h.vy, h.vx);
  // The rotor's chop, while it is about.
  h.chop -= dt;
  if (h.chop <= 0) {
    h.chop = 0.09;
    if (onScreen(h.x, h.y, 60)) noise(0.04, 0.05, 220);
  }
}
/** Whether the helicopter is over the player, lighting them up: then the heat does not cool. */
export function heliOver() {
  const h = G.heli,
    p = ppos();
  return !!h && !h.leaving && hyp(h.x - p.x, h.y - p.y) < HELI.light + HELI.orbit;
}
