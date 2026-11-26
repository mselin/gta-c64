// SPDX-License-Identifier: GPL-2.0-or-later
// The scale the city is drawn at, which the player can change in the browser and desktop versions: Z, or the
// button on the info page. See ZOOM and setZoom in config.js, and specs/design.md, "The scale".
import { PERSON, VIEW_H, VIEW_W, WPX, ZOOM, ZOOMS, setZoom } from './config.js';
import { clamp } from './util.js';
import { G, isRider, msg, ppos } from './state.js';

const SAVED = 'sb64zoom';
const SAY = {
  1: 'SCALE 1X: PEOPLE AS BIG AS CARS. THE CLASSIC LOOK.',
  2: 'SCALE 2X: CARS CLOSER TO LIFE SIZE.',
  3: 'SCALE 3X: TRUE TO SCALE. LOOK WHERE YOU ARE GOING.',
};

/** The scale the player chose last time, if any. Called before the city is built, so everyone starts at it. */
export function loadZoom() {
  try {
    const z = Number(localStorage.getItem(SAVED));
    if (ZOOMS.includes(z)) setZoom(z);
  } catch (e) {}
}

/** Change the scale in play: people already about keep their pace on screen, and the view centres again. */
export function useZoom(z, say = true) {
  if (!ZOOMS.includes(z)) return;
  const was = PERSON;
  setZoom(z);
  // Pace is a person's, so it scales with them; a scooter's or a skateboard's speed is its own.
  for (const p of G.peds) if (!isRider(p)) p.spd *= PERSON / was;
  const at = ppos();
  G.camX = clamp(at.x - VIEW_W / 2, 0, WPX - VIEW_W);
  G.camY = clamp(at.y - VIEW_H / 2, 0, WPX - VIEW_H);
  try {
    localStorage.setItem(SAVED, String(z));
  } catch (e) {}
  if (say) msg(SAY[z]);
}

/** The next scale round: 1, 2, 3, 1 ... */
export const nextZoom = () => useZoom(ZOOMS[(ZOOMS.indexOf(ZOOM) + 1) % ZOOMS.length]);
