// SPDX-License-Identifier: GPL-2.0-or-later
// Draws every screen: boot, title, the city with its HUD, and the win screen.
import {
  BOOT,
  BX,
  BY,
  GOAL,
  HELI,
  KIND,
  DIFFICULTY_Y,
  PAL,
  PI,
  SH,
  SW,
  TITLE_PAGES,
  VH,
  ZOOM,
} from './config.js';
import { R, clamp, hyp, mod } from './util.js';
import { cx, g, scr } from './screen.js';
import { ctext, text } from './font.js';
import { ARW, HELI_BODY, HELI_ROTOR, carSpr, pedSpr } from './sprites.js';
import { FRAME, PLAYER_OUTLINE, poseOf } from './figures.js';
import { CHOP, JOBPTS, PAINT, crossing, waterAt } from './world.js';
import { mapC } from './worldview.js';
import { G, forDifficulty, onScreen, P, ppos, sirenFlash, touch, weapon, weaponLabel } from './state.js';
import { npText, radio, radioAudible } from './radio.js';
import { drawEnding } from './endings.js';
import { help } from './help.js';

// The camera in screen pixels, and where a point in the city is on the screen: ZOOM screen pixels to a city pixel.
let camXi = 0;
let camYi = 0;
const sx = (x) => Math.round(x * ZOOM) - camXi,
  sy = (y) => Math.round(y * ZOOM) - camYi;
/** A sprite at a point in the city, `z` times its size: ZOOM for cars, 1 for people, who keep their screen size. */
function drawSpr(fr, a, x, y, z = ZOOM) {
  const n = fr.length,
    i = mod(Math.round((a / (PI * 2)) * n), n),
    s = fr[0].width * z;
  g.drawImage(fr[i], sx(x) - Math.round(s / 2), sy(y) - Math.round(s / 2), s, s);
}
/**
 * A job marker (J, P, X): a flashing square with its letter, 12 city pixels across, drawn at the city's scale like
 * the pickups, so it is the size it always was beside the streets.
 */
function marker(x, y, ch, c1, c2) {
  if (!onScreen(x, y, 10)) return;
  const f = Math.floor(G.clock * 4) & 1,
    z = ZOOM,
    mx = sx(x),
    my = sy(y);
  g.fillStyle = PAL[f ? c1 : c2];
  g.fillRect(mx - 6 * z, my - 6 * z, 12 * z, 12 * z);
  g.fillStyle = PAL[0];
  g.fillRect(mx - 5 * z, my - 5 * z, 10 * z, 10 * z);
  text(ch, mx - 4 * z, my - 4 * z, f ? c1 : c2, z);
}
const PKI = {
  ammo: ['A', 8, 7],
  cash: ['$', 5, 13],
  donut: ['O', 10, 1],
  med: ['+', 1, 2],
  knife: ['K', 15, 0],
};
/** Someone in the water: just a head and one arm above the surface, with ripples round them. */
function drawSwimmer(p) {
  const wx = sx(p.x),
    wy = sy(p.y),
    f = Math.floor(G.clock * 3 + p.x * 0.1) & 1;
  g.fillStyle = PAL[14];
  g.fillRect(wx - 5, wy + (f ? 1 : 2), 3, 1);
  g.fillRect(wx + 3, wy + (f ? 2 : 1), 3, 1);
  g.fillRect(wx - 2, wy + 3, 5, 1);
  g.fillStyle = PAL[1];
  g.fillRect(f ? wx - 3 : wx + 3, wy + 3, 1, 1);
  // The player keeps the outlines they have on land round their head: outermost first, corners cut.
  if (p === P)
    for (let r = PLAYER_OUTLINE.length; r > 0; r--) {
      g.fillStyle = PAL[PLAYER_OUTLINE[r - 1]];
      g.fillRect(wx - 1 - r, wy - 1 - r, 3 + 2 * r, 2 + 2 * r);
      g.fillRect(wx - r, wy - 2 - r, 1 + 2 * r, 4 + 2 * r);
    }
  g.fillStyle = PAL[p.hair];
  g.fillRect(wx - 1, wy - 2, 3, 2);
  g.fillStyle = PAL[p.skin];
  g.fillRect(wx - 1, wy, 3, 2);
  g.fillRect(f ? wx - 3 : wx + 3, wy - 1, 1, 2);
}
/**
 * The police helicopter: its searchlight on the ground under it, a ring of yellow dots going round, then the
 * helicopter itself HELI.alt above that, over everything in the city, its rotor spinning.
 */
function drawHeli() {
  const h = G.heli;
  if (!h || !onScreen(h.x, h.y - HELI.alt, 40)) return;
  const z = ZOOM,
    r = (HELI.light / 2) * z,
    cx = sx(h.x),
    cy = sy(h.y);
  if (!h.leaving) {
    g.fillStyle = PAL[7];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2 + G.clock * 2;
      g.fillRect(
        Math.round(cx + Math.cos(a) * r) - (z >> 1),
        Math.round(cy + Math.sin(a) * r) - (z >> 1),
        z,
        z,
      );
    }
  }
  const y = h.y - HELI.alt;
  drawSpr(HELI_BODY, h.a, h.x, y);
  drawSpr(HELI_ROTOR, G.clock * 40, h.x + Math.cos(h.a) * 3, y + Math.sin(h.a) * 3);
}
function drawWorld() {
  camXi = Math.round(G.camX * ZOOM);
  camYi = Math.round(G.camY * ZOOM);
  g.drawImage(mapC, camXi / ZOOM, camYi / ZOOM, SW / ZOOM, VH / ZOOM, 0, 0, SW, VH);
  for (const j of JOBPTS) if (!G.job) marker(j.x, j.y, 'J', 7, 4);
  marker(PAINT.x, PAINT.y, 'P', 3, 1);
  if (G.job && G.job.def.type === 'steal' && G.job.stage === 1) marker(CHOP.x, CHOP.y, 'X', 7, 2);
  if (G.job && G.job.def.type === 'go') marker(G.job.target.x, G.job.target.y, 'X', 7, 2);
  for (const k of G.pickups) {
    if (k.t > 0 || !onScreen(k.x, k.y, 8)) continue;
    if (k.temp != null && k.temp < 4 && Math.floor(G.clock * 8) & 1) continue;
    // 8 city pixels square with a black edge, its letter in it: drawn at the city's scale, as big beside the
    // streets as they always were. It bobs a city pixel.
    const d = PKI[k.type],
      z = ZOOM,
      kx = sx(k.x) - 4 * z,
      ky = sy(k.y) - 4 * z + (Math.floor(G.clock * 3 + k.x) & 1) * z;
    g.fillStyle = PAL[0];
    g.fillRect(kx - z, ky - z, 10 * z, 10 * z);
    g.fillStyle = PAL[d[1]];
    g.fillRect(kx, ky, 8 * z, 8 * z);
    text(d[0], kx, ky, d[2], z);
  }
  // GAGGLE cameras: a dark grey pole with a black camera on top, its light-red light on now and then as it records,
  // flashing when it reports or its alarm sounds. One that has been put out of action lies on the ground.
  for (const cam of G.cams) {
    if (!onScreen(cam.x, cam.y, 12)) continue;
    const z = ZOOM,
      x = sx(cam.x),
      y = sy(cam.y);
    if (cam.dead) {
      g.fillStyle = PAL[11];
      g.fillRect(x - 4 * z, y, 8 * z, z);
      g.fillStyle = PAL[0];
      g.fillRect(x + 4 * z, y - z, 3 * z, 3 * z);
      continue;
    }
    g.fillStyle = PAL[11];
    g.fillRect(x, y - 7 * z, z, 8 * z);
    g.fillStyle = PAL[0];
    g.fillRect(x - 2 * z, y - 10 * z, 5 * z, 3 * z);
    const lit =
      cam.alarm > 0
        ? cam.hi
        : cam.flash > 0
          ? Math.floor(G.clock * 8) & 1
          : Math.floor(G.clock * 1.5) % 3 === 0;
    if (lit) {
      g.fillStyle = PAL[10];
      g.fillRect(x + z, y - 9 * z, 2 * z, 2 * z);
    }
  }
  for (const p of G.peds) {
    if (!onScreen(p.x, p.y, FRAME / 2)) continue;
    // A goose floats: Big Honk is drawn the same in the water, just without his feet.
    if (waterAt(p.x, p.y) && p.type !== 'honk') drawSwimmer(p);
    else drawSpr(pedSpr(p, poseOf(p)), Math.atan2(p.dy, p.dx), p.x, p.y, 1);
    if (p.ko > 0) {
      // Two little stars going round just over the head of someone knocked down.
      const a = Math.atan2(p.dy, p.dx),
        hx = sx(p.x) + Math.cos(a) * 5,
        hy = sy(p.y) + Math.sin(a) * 5 - 6;
      g.fillStyle = PAL[7];
      for (const o of [0, PI]) {
        const t = G.clock * 6 + o;
        const tx = Math.round(hx + Math.cos(t) * 5),
          ty = Math.round(hy + Math.sin(t) * 2);
        g.fillRect(tx - 1, ty, 3, 1);
        g.fillRect(tx, ty - 1, 1, 3);
      }
    }
  }
  if (!P.car && G.screen !== 'down' && !(P.hitT > 0 && Math.floor(G.clock * 20) & 1)) {
    if (waterAt(P.x, P.y)) drawSwimmer(P);
    else drawSpr(pedSpr(P, poseOf(P)), P.a, P.x, P.y, 1);
  }
  for (const c of G.cars) {
    if (!onScreen(c.x, c.y, 20)) continue;
    drawSpr(carSpr(c), c.a, c.x, c.y);
    if (c.kind === KIND.police && !c.dead && c.ai === 'cop' && G.heat > 0) {
      const f = Math.floor(G.clock * 6) & 1,
        bx = sx(c.x),
        by = sy(c.y);
      g.fillStyle = PAL[f ? 2 : 14];
      g.fillRect(bx - 2 * ZOOM, by - ZOOM, 2 * ZOOM, 2 * ZOOM);
      g.fillStyle = PAL[f ? 14 : 2];
      g.fillRect(bx, by - ZOOM, 2 * ZOOM, 2 * ZOOM);
    }
    // A car alarm flashes the hazard lights at its four corners, yellow, with its high note.
    if (c.alarmHi) {
      const cs = Math.cos(c.a),
        sn = Math.sin(c.a),
        h = c.kind.L / 2 - 2,
        w = c.kind.W / 2 - 2;
      g.fillStyle = PAL[7];
      for (const [u, v] of [
        [h, w],
        [h, -w],
        [-h, w],
        [-h, -w],
      ])
        g.fillRect(
          sx(c.x + cs * u - sn * v) - Math.round(1.5 * ZOOM),
          sy(c.y + sn * u + cs * v) - Math.round(1.5 * ZOOM),
          3 * ZOOM,
          3 * ZOOM,
        );
    }
    if (G.job && G.job.car === c && G.job.stage === 0 && Math.floor(G.clock * 4) & 1)
      text('!', sx(c.x) - 4, sy(c.y) - 12 * ZOOM - 8, 7);
  }
  for (const b of G.bullets) {
    g.fillStyle = PAL[b.own ? 1 : 7];
    g.fillRect(sx(b.x), sy(b.y), 2 * ZOOM, 2 * ZOOM);
  }
  drawHeli();
  for (const p of G.parts) {
    g.fillStyle = PAL[p.col];
    const s = p.s || 1;
    g.fillRect(sx(p.x), sy(p.y), s * ZOOM, s * ZOOM);
  }
  for (const p of G.pops) {
    if (p.hud) continue;
    const w = p.t.length * 8;
    text(p.t, clamp(sx(p.x) - Math.round(w / 2), 0, SW - w), sy(p.y), p.col);
  }
  // target arrow
  const tg = G.job && G.job.target;
  if (tg && !onScreen(tg.x, tg.y, -12)) {
    const p = ppos(),
      a = Math.atan2(tg.y - p.y, tg.x - p.x);
    const ax = clamp(sx(p.x) + Math.cos(a) * 400, 10, SW - 10),
      ay = clamp(sy(p.y) + Math.sin(a) * 400, 10, VH - 10);
    const fr = ARW[Math.floor(G.clock * 5) & 1];
    g.drawImage(fr[mod(Math.round((a / (PI * 2)) * 16), 16)], Math.round(ax) - 5, Math.round(ay) - 5);
  } else if (!G.job) {
    let bj = null,
      bd = 1e9;
    const p = ppos();
    for (const j of JOBPTS) {
      const d = hyp(j.x - p.x, j.y - p.y);
      if (d < bd) {
        bd = d;
        bj = j;
      }
    }
    if (bj && !onScreen(bj.x, bj.y, -12)) {
      const a = Math.atan2(bj.y - p.y, bj.x - p.x),
        ax = clamp(sx(p.x) + Math.cos(a) * 400, 10, SW - 10),
        ay = clamp(sy(p.y) + Math.sin(a) * 400, 10, VH - 10);
      g.drawImage(ARW[0][mod(Math.round((a / (PI * 2)) * 16), 16)], Math.round(ax) - 5, Math.round(ay) - 5);
    }
  }
  // With heat, at the wheel: a cyan arrow with an S to the paint shop, where the heat goes.
  if (G.heat > 0 && P.car && !onScreen(PAINT.x, PAINT.y, -12)) {
    const p = ppos(),
      a = Math.atan2(PAINT.y - p.y, PAINT.x - p.x),
      ax = Math.round(clamp(sx(p.x) + Math.cos(a) * 400, 10, SW - 10)),
      ay = Math.round(clamp(sy(p.y) + Math.sin(a) * 400, 10, VH - 10));
    g.drawImage(ARW[2][mod(Math.round((a / (PI * 2)) * 16), 16)], ax - 5, ay - 5);
    // The S beside it, on the side towards the middle of the view, on black so it reads over the city.
    const lx = clamp(ax - Math.round(Math.cos(a) * 12) - 4, 1, SW - 9),
      ly = clamp(ay - Math.round(Math.sin(a) * 12) - 4, 1, VH - 9);
    g.fillStyle = PAL[0];
    g.fillRect(lx - 1, ly - 1, 10, 10);
    text('S', lx, ly, 3);
  }
  for (const p of G.pops)
    if (p.hud) {
      const w = p.t.length * 8;
      g.fillStyle = PAL[0];
      g.fillRect((SW - w) / 2 - 4, 6, w + 8, 12);
      text(p.t, (SW - w) / 2, 8, p.col);
    }
  if (G.banner) {
    // The box grows down a line for each line of small text after the first.
    const b = G.banner,
      sc = b.big ? 2 : 1,
      bottom = 91 + Math.max(1, b.lines.length) * 10;
    g.fillStyle = PAL[0];
    g.fillRect(0, 58, SW, bottom - 57);
    g.fillStyle = PAL[b.col];
    g.fillRect(0, 58, SW, 1);
    g.fillRect(0, bottom, SW, 1);
    ctext(b.t, b.big ? 64 : 70, b.col, sc);
    b.lines.forEach((line, i) => ctext(line, 88 + i * 10, 1));
  }
  if (G.paused) {
    g.fillStyle = PAL[0];
    g.fillRect(100, 76, 120, 24);
    ctext('PAUSED', 84, 1);
  }
  if (G.quitAsk) {
    g.fillStyle = PAL[14];
    g.fillRect(36, 62, 248, 52);
    g.fillStyle = PAL[6];
    g.fillRect(40, 66, 240, 44);
    ctext('RETURN TO TITLE SCREEN?', 74, 1);
    ctext(help().confirm, 92, 7);
  }
  // Where a finger is steering to: a small cross, so it is clear what the player is heading for.
  if (touch.at && touch.at.y < VH) {
    const x = Math.round(touch.at.x),
      y = Math.round(touch.at.y);
    g.fillStyle = PAL[0];
    g.fillRect(x - 5, y - 1, 11, 3);
    g.fillRect(x - 1, y - 5, 3, 11);
    g.fillStyle = PAL[7];
    g.fillRect(x - 4, y, 9, 1);
    g.fillRect(x, y - 4, 1, 9);
  }
  // panel
  g.fillStyle = PAL[0];
  g.fillRect(0, VH, SW, SH - VH);
  g.fillStyle = PAL[11];
  g.fillRect(0, VH, SW, 1);
  text('$' + String(G.cash).padStart(6, '0'), 0, VH + 1, 13);
  text('HEAT', 64, VH + 1, 15);
  for (let i = 0; i < 5; i++)
    text('*', 100 + i * 8, VH + 1, i < G.heat ? (Math.floor(G.clock * 4) & 1 ? 2 : 7) : 11);
  text('HP', 148, VH + 1, 15);
  g.fillStyle = PAL[11];
  g.fillRect(168, VH + 2, 42, 6);
  g.fillStyle = PAL[P.hp > 30 ? 5 : 2];
  g.fillRect(169, VH + 3, Math.round(P.hp * 0.4), 4);
  if (P.car) {
    // Room on its right for the ammo: AMMO99 takes the last 48 pixels.
    text('CAR', 214, VH + 1, 15);
    g.fillStyle = PAL[11];
    g.fillRect(240, VH + 2, 28, 6);
    g.fillStyle = PAL[P.car.hp > 40 ? 3 : 2];
    g.fillRect(241, VH + 3, Math.round(clamp(P.car.hp / P.car.kind.hp, 0, 1) * 26), 4);
  }
  // What fire does on foot: the ammo left, or the knife or fists once it runs out.
  const wpn = weapon(),
    label = weaponLabel();
  text(label, SW - label.length * 8, VH + 1, wpn === 'gun' ? 7 : wpn === 'knife' ? 15 : 10);
  if (G.job) {
    const d = G.job.def,
      t = Math.max(0, Math.ceil(G.job.t)),
      tm = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    let pr = '';
    if (d.type === 'kill' || d.type === 'wreck') pr = G.job.n + '/' + d.n;
    if (d.type === 'survive') pr = Math.floor(G.job.acc) + '/' + d.n + 'S';
    if (d.type === 'find') {
      // Where the player is, in the same avenue-street form as the clue.
      const at = crossing(ppos().x, ppos().y);
      pr = at.ave + '-' + at.st;
    }
    text(d.t.slice(0, 24), 0, VH + 9, 7);
    text(pr, 216, VH + 9, 1);
    text(tm, 280, VH + 9, t < 15 && Math.floor(G.clock * 4) & 1 ? 2 : 1);
  } else text('NO JOB. FOLLOW THE ARROW TO A "J".', 0, VH + 9, 12);
  if (G.msgT > 0) {
    const w = G.msgTxt.length * 8;
    let x = 0;
    if (w > SW) x = -Math.round(clamp((G.msgAge - 1) * 70, 0, w - SW));
    text(G.msgTxt, x, VH + 17, 1);
  } else if (P.car && radioAudible()) {
    const t = 'RADIO ' + radio[G.station].name + ': ' + npText() + '   ',
      w = t.length * 8;
    if (w <= SW) text(t, 0, VH + 17, 14);
    else {
      const o = Math.floor(G.clock * 45) % w;
      text(t, -o, VH + 17, 14);
      text(t, w - o, VH + 17, 14);
    }
  } else text('ELECTION FUND: $' + G.cash + ' / $' + GOAL, 0, VH + 17, 11);
}
const BARS = [2, 8, 7, 13, 3, 14, 4, 10, 1, 10, 4, 14, 3, 13, 7, 8];
const logoC = document.createElement('canvas');
logoC.width = 240;
logoC.height = 24;
const lg = logoC.getContext('2d');
lg.imageSmoothingEnabled = false;
const SCROLL =
  '        GREETINGS TO ALL PARKING WARDENS, LANDLORDS AND E-SCOOTER ENTHUSIASTS ... THIS GAME WAS NOT CRACKED BY ANYBODY ... ANY RESEMBLANCE TO REAL CITIES IS A COINCIDENCE AND ALSO YOUR FAULT ... ALL CRIMES DEPICTED ARE 8-BIT AND THEREFORE VICTIMLESS ... PRESS FIRE TO BEGIN YOUR CIVIC ENGAGEMENT ...        ';
/**
 * The sunset picture (assets/title-sunset.png): 320 x 180, double-wide pixels in the C64 colours, from the owner's
 * artwork. The title screen shows it in turn with its text page, and the boot shows it loading, as a C64 game
 * showed a picture while it loaded.
 */
const SUNSET = new Image();
SUNSET.src = new URL('../assets/title-sunset.png', import.meta.url).href;
const SUNSET_H = 180;
/** Whether the sunset picture has loaded. For the tests. */
export const sunsetLoaded = () => SUNSET.complete && SUNSET.naturalWidth > 0;
/** Which page the title screen shows `t` seconds after it came up: 'text' first, then 'picture', in turn. */
export const titlePage = (t) =>
  t % (TITLE_PAGES.text + TITLE_PAGES.picture) < TITLE_PAGES.text ? 'text' : 'picture';
/** The greetings scrolling along a line of the title screen. */
function scroller(y) {
  // On classic the greetings go to skating enthusiasts rather than e-scooter ones.
  const t = forDifficulty(SCROLL),
    off = Math.floor(G.clock * 60) % (t.length * 8);
  text(t, -off, y, 13);
  if (off > t.length * 8 - SW) text(t, t.length * 8 - off, y, 13);
}
/** The title's picture page: the sunset, and under it the call to start, blinking, and the greetings. */
function drawTitlePicture() {
  g.fillStyle = PAL[0];
  g.fillRect(0, 0, SW, SH);
  g.drawImage(SUNSET, 0, 0);
  if (Math.floor(G.clock * 2) & 1) ctext(help().start, SUNSET_H + 4, 1);
  scroller(SUNSET_H + 12);
}
function drawTitle() {
  if (titlePage(G.clock - G.titleAt) === 'picture' && sunsetLoaded()) return drawTitlePicture();
  g.fillStyle = PAL[0];
  g.fillRect(0, 0, SW, SH);
  lg.globalCompositeOperation = 'source-over';
  lg.clearRect(0, 0, 240, 24);
  text('SLEAZEBURG', 0, 0, 1, 3, lg);
  lg.globalCompositeOperation = 'source-atop';
  for (let y = 0; y < 24; y++) {
    lg.fillStyle = PAL[BARS[mod(y + Math.floor(G.clock * 14), BARS.length)]];
    lg.fillRect(0, y, 240, 1);
  }
  for (let i = 0; i < 6; i++) {
    g.fillStyle = PAL[BARS[mod(i + Math.floor(G.clock * 6), BARS.length)]];
    g.fillRect(0, 12 + i * 2, SW, 1);
    g.fillRect(0, 68 + i * 2, SW, 1);
  }
  g.drawImage(logoC, 40, 30);
  text('64', 264, 58, 7);
  ctext('A TOTALLY ORIGINAL CRIME SATIRE', 86, 15);
  ctext('8 BITS. 16 COLOURS. 0 SCRUPLES.', 96, 12);
  ctext(help().difficulty(G.difficulty), DIFFICULTY_Y, G.difficulty === 'classic' ? 12 : 7);
  help().controls.forEach((line, i) => text(line, 48, 116 + i * 10, i < 4 ? 3 : 14));
  {
    const t = G.musicOn ? (radioAudible() ? 'NOW PLAYING: ' + npText() : 'TUNING IN ...') : help().musicOff;
    if (t.length <= 40) ctext(t, 166, G.musicOn ? 7 : 12);
    else {
      const u = t + '     ',
        w = u.length * 8,
        o = Math.floor(G.clock * 45) % w;
      text(u, -o, 166, 7);
      text(u, w - o, 166, 7);
    }
  }
  if (Math.floor(G.clock * 2) & 1) ctext(help().start, 176, 1);
  scroller(188);
}
/**
 * The boot's loading picture: black, and the sunset arriving a character row (8 pixels) at a time from the top,
 * as a C64 loading screen did, all there by BOOT.loaded.
 */
function drawLoading(t) {
  g.fillStyle = PAL[0];
  g.fillRect(0, 0, SW, SH);
  if (!sunsetLoaded()) return;
  const rows = Math.ceil(SUNSET_H / 8),
    shown = Math.min(rows, Math.floor(((t - BOOT.picture) / (BOOT.loaded - BOOT.picture)) * rows)) * 8,
    top = (SH - SUNSET_H) / 2;
  if (shown > 0) g.drawImage(SUNSET, 0, 0, SW, shown, 0, top, SW, shown);
}
function drawBoot() {
  const t = G.bootT,
    c = 14;
  if (t > BOOT.picture && t < BOOT.ready) return drawLoading(t);
  g.fillStyle = PAL[6];
  g.fillRect(0, 0, SW, SH);
  text('    **** SLEAZEBURG 64 BASIC V2 ****', 0, 8, c);
  text(' 64K RAM SYSTEM  38911 MORAL BYTES FREE', 0, 24, c);
  if (t > 0.7) text('READY.', 0, 40, c);
  const cmd = 'LOAD"CRIME",8,1';
  if (t > 1.1) text(cmd.slice(0, Math.floor((t - 1.1) * 14)), 0, 48, c);
  if (t > 2.5) text('SEARCHING FOR CRIME', 0, 64, c);
  if (t > BOOT.loading) text('LOADING', 0, 72, c);
  if (t > BOOT.ready) text('READY.', 0, 80, c);
  if (t > BOOT.ready) text('RUN', 0, 88, c);
  if (Math.floor(t * 3) & 1) {
    g.fillStyle = PAL[c];
    const y = t < 0.7 ? 40 : t < 2.5 ? 48 : t < BOOT.ready ? 80 : 96;
    const x = t > 1.1 && t < 2.5 ? Math.min(cmd.length, Math.floor((t - 1.1) * 14)) * 8 : 0;
    if (t < 2.5 || t > BOOT.ready) g.fillRect(x, y, 8, 8);
  }
}
let lastScreen = '';
export function draw() {
  let border = 0;
  // The title screen starts on its text page each time it comes up.
  if (G.screen === 'title' && lastScreen !== 'title') G.titleAt = G.clock;
  lastScreen = G.screen;
  if (G.screen === 'boot') {
    drawBoot();
    border = 14;
  } else if (G.screen === 'title') drawTitle();
  else if (G.screen === 'win' || G.screen === 'over') {
    drawEnding(G.screen);
    border = G.screen === 'win' ? 9 : 0;
  } else {
    drawWorld();
    if (sirenFlash()) border = Math.floor(G.clock * 2) & 1 ? 2 : 6;
  }
  cx.fillStyle = PAL[border];
  cx.fillRect(0, 0, 384, 272);
  // Loading: the border flashes in bands of random colours, as a C64's did while it read the disk.
  if (G.screen === 'boot' && G.bootT > BOOT.loading && G.bootT < BOOT.loaded) {
    for (let y = 0; y < 272;) {
      const h = 2 + Math.floor(R() * 10);
      cx.fillStyle = PAL[Math.floor(R() * 16)];
      cx.fillRect(0, y, 384, h);
      y += h;
    }
  }
  cx.drawImage(scr, BX, BY);
}
