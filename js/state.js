// SPDX-License-Identifier: GPL-2.0-or-later
// Shared game state, the player, held keys, and the on-screen message helpers.
import { PI, SW, VIEW_H, VIEW_W } from './config.js';
import { HOSP } from './world.js';
import { wrapEven } from './util.js';

/** The parts of the state that belong to one game, as they are when it starts. */
const freshGame = () => ({
  paused: false,
  cars: [],
  peds: [],
  bullets: [],
  parts: [], // particles
  pickups: [],
  cams: [], // GAGGLE cameras (js/cams.js)
  camSaid: -99, // when one last said something about a crime it saw (G.clock)
  pops: [], // floating texts
  cash: 0,
  heat: 0,
  heatPts: 0, // crime points; heat is the level they add up to
  heatCool: 0,
  camX: 0,
  camY: 0,
  msgTxt: '', // the message on the bottom line of the HUD
  msgT: 0,
  msgAge: 0,
  banner: null, // large centre-screen text, or null
  downT: 0,
  sirenT: 0, // time to the next wail of the siren
  siren: false, // the police are close and the siren is going
  job: null, // the active job, or null
  quitAsk: false, // the return-to-title dialog is open
});
const freshPlayer = () => ({
  x: HOSP.x,
  y: HOSP.y,
  a: PI / 2,
  hp: 100,
  ammo: 12,
  knife: false, // found on the street or dropped; lost when wasted or busted
  car: null,
  cd: 0,
  anim: 0, // steps walked: the walking pose (figures.js)
  arm: 0, // the pose with the arm out, and how long it is held
  armT: 0,
  hitT: 0,
  // A yellow jacket that nobody else wears, black jeans and, for the player alone, a white outline (figures.js).
  shirt: 7,
  hair: 0,
  skin: 10,
  legs: 0,
  type: 'player',
  swim: false, // in the water
});
// Everything about the running game that more than one module changes.
export const G = {
  fxOn: true,
  musicOn: false,
  // 'boot', 'title', 'play', 'down' (dead or arrested, about to respawn), 'over' (arrested broke) or 'win'
  screen: 'boot',
  bootT: 0,
  clock: 0,
  titleAt: 0, // when the title screen last came up (G.clock): it starts on its text page
  sidPlayer: null, // the SID player module once it has loaded
  station: 0, // index of the tuned radio station
  nowPlaying: null, // the radio track that is loaded, or null
  infoOpen: false, // the information page is open
  ...freshGame(),
};
export const K = {},
  edge = {};
/** Where a finger is held on the game screen, in screen pixels (0-319 across, 0-199 down), or null.
 * Set by input.js; on a touch screen it steers the player instead of the arrow keys. */
export const touch = { at: null };
export const P = freshPlayer();
/** Put the game and the player back to how a new game starts. Sound settings and the radio are left alone. */
export function resetState() {
  Object.assign(G, freshGame());
  Object.assign(P, freshPlayer());
}
export function msg(s) {
  G.msgTxt = s.toUpperCase();
  G.msgT = Math.max(4, s.length * 0.14 + 1.5);
  G.msgAge = 0;
}
/** Characters a line of small text may have in a banner: 38 of the screen's 40, so it keeps a margin. */
export const BANNER_COLS = (SW - 16) / 8;
/**
 * Large text across the middle of the screen, with a line or more of small text under it, for `dur` seconds.
 * The small text is broken into even lines that fit the screen. A title too long for big letters is drawn small.
 */
export function bigText(t, sub, col, dur) {
  G.banner = {
    t,
    sub,
    col,
    d: dur || 2.5,
    big: t.length * 16 <= SW - 16,
    lines: sub ? wrapEven(sub, BANNER_COLS) : [],
  };
}
export function pop(x, y, t, col) {
  G.pops.push({ x, y, t, col: col || 1, l: 1.2 });
}
export const ppos = () => P.car || P;
/**
 * The car whose body is at (x, y), with `r` to spare round it, or null: the car's length and width, turned with
 * it. Cars are solid for anyone on foot, stopped or moving; one on the bottom of the canal is out of the way.
 */
export function carBodyAt(x, y, r) {
  for (const c of G.cars) {
    const dx = x - c.x,
      dy = y - c.y;
    if (Math.abs(dx) > 20 || Math.abs(dy) > 20) continue;
    if (c.flooded && c.sink >= 1) continue;
    const cs = Math.cos(c.a),
      sn = Math.sin(c.a);
    if (Math.abs(dx * cs + dy * sn) <= c.kind.L / 2 + r && Math.abs(-dx * sn + dy * cs) <= c.kind.W / 2 + r)
      return c;
  }
  return null;
}
/**
 * Whether the screen border flashes red and blue: only while the siren is actually going, in play, with the game
 * running. Not on the busted or flatlined screen, not paused or behind a dialog, and not once the police are gone.
 */
export const sirenFlash = () => G.siren && G.screen === 'play' && !G.paused && !G.quitAsk && !G.infoOpen;
/** What fire does on foot now: 'gun' while there is ammo, then 'knife' if the player has one, else 'fist'. */
export const weapon = () => (P.ammo > 0 ? 'gun' : P.knife ? 'knife' : 'fist');
/** The HUD's word for it: the ammo left (AMMO12), or KNIFE or FIST once it runs out. */
export const weaponLabel = () =>
  weapon() === 'gun' ? 'AMMO' + String(P.ammo).padStart(2, '0') : weapon().toUpperCase();
export const onScreen = (x, y, m) =>
  x > G.camX - m && x < G.camX + VIEW_W + m && y > G.camY - m && y < G.camY + VIEW_H + m;
