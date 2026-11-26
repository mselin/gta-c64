// SPDX-License-Identifier: GPL-2.0-or-later
// The wanted level: crimes raise it, losing the police lowers it. Also the paint shop, district names and news ticker.
import { CCOLS, DISTRICTS, HEATMSG, HT, KIND, NEWS, NOTICE, STOLEN_CRUISER_HEAT } from './config.js';
import { R, hyp, pick } from './util.js';
import { PAINT, districtAt } from './world.js';
import { sfx, tone } from './audio.js';
import { G, P, forDifficulty, msg, ppos } from './state.js';
import { down } from './player.js';
import { reported, seenBy } from './cams.js';
import { heliOver } from './heli.js';

let district = '';
let newsT = 12;
let paintCd = 0;
export function resetHeat() {
  district = '';
  newsT = 12;
  paintCd = 0;
}
/** A crime by the player, worth `n` points of heat; more if a GAGGLE camera sees them do it (js/cams.js). */
export function crime(n) {
  const p = ppos(),
    cam = seenBy(p.x, p.y);
  if (cam) n += reported(cam, n);
  addHeat(n);
}
/** `n` more points of heat, and the level they make, announced if it went up. */
function addHeat(n) {
  G.heatPts = Math.min(230, G.heatPts + n);
  G.heatCool = 0;
  let h = 0;
  for (let i = 1; i < 6; i++) if (G.heatPts >= HT[i]) h = i;
  if (h > G.heat) {
    G.heat = h;
    msg(HEATMSG[h]);
    sfx.alarm();
  }
}
/**
 * Which police are about the player at `p`, at the distances they notice the player at (NOTICE): a police car
 * chasing them (`chase`), an officer on foot who is not knocked down (`foot`), and a manned, unwrecked police car on
 * patrol in ordinary traffic (`patrol`). The car the player is driving is not one of them.
 */
export function policeAbout(p = ppos()) {
  let chase = false,
    foot = false,
    patrol = false;
  for (const c of G.cars) {
    if (c === P.car) continue;
    const d = hyp(c.x - p.x, c.y - p.y);
    if (c.ai === 'cop' && d < NOTICE.car) chase = true;
    else if (c.ai === 'traffic' && c.kind === KIND.police && c.driver && !c.dead && d < NOTICE.patrol)
      patrol = true;
  }
  for (const q of G.peds)
    if (q.type === 'cop' && !(q.ko > 0) && hyp(q.x - p.x, q.y - p.y) < NOTICE.foot) {
      foot = true;
      break;
    }
  return { chase, foot, patrol };
}
/** Whether any of the police are about the player (policeAbout): what decides if they take the weapons. */
export function policeNear() {
  const a = policeAbout();
  return a.chase || a.foot || a.patrol;
}
/** Seconds on end that arrest a player at the wheel: boxed in by chasing cars, or an officer at the window. */
export const BUST = { boxed: 2, window: 0.7 };
export function updHeat(dt) {
  const p = ppos(),
    about = policeAbout(p),
    // Close enough to keep the heat up and set the siren off: a chasing car or an officer on foot.
    near = about.chase || about.foot;
  // The police know their own cruisers, and know the player is not one of them. A patrol car in ordinary
  // traffic notices too: there are police about even before the player has any heat.
  if (G.screen === 'play' && P.car && P.car.kind === KIND.police && G.heat < STOLEN_CRUISER_HEAT) {
    if (near || about.patrol) {
      // Straight up to the level, not as a crime: no GAGGLE camera adds to it or reports it.
      addHeat(HT[STOLEN_CRUISER_HEAT] - G.heatPts);
      msg('THE COPS KNOW THAT CRUISER. THEY DO NOT KNOW YOU.');
    }
  }
  if (G.heat > 0) {
    // The helicopter overhead keeps the heat up as the police near do; it does not set the siren off.
    if (near || heliOver()) G.heatCool = 0;
    else {
      G.heatCool += dt;
      if (G.heatCool > 9) {
        G.heat--;
        G.heatPts = HT[G.heat];
        G.heatCool = 0;
        msg(G.heat ? 'HEAT DROPPING. THEY FOUND A BIGGER FISH.' : 'HEAT GONE. THE CASE HAS BEEN "MISFILED".');
      }
    }
    if (near) {
      G.sirenT -= dt;
      if (G.sirenT <= 0) {
        G.sirenT = 0.7;
        tone(620, 620, 0.33, 'square', 0.07);
        tone(830, 830, 0.33, 'square', 0.07, 0.35);
      }
    } else G.sirenT = 0; // out of earshot: it starts afresh when they are back
  }
  // The siren, and the border flashing with it, only while the police are close in play.
  G.siren = G.heat > 0 && near && G.screen === 'play';
  // Arrested at the wheel: boxed in by chasing cars for BUST.boxed seconds on end, or an officer at the window for
  // BUST.window seconds on end. Each has its own count, back to 0 the moment the player gets free of it.
  const car = P.car;
  if (car && G.screen === 'play') {
    const boxed =
      G.heat > 0 &&
      hyp(car.vx, car.vy) < 12 &&
      G.cars.some((c) => c.ai === 'cop' && hyp(c.x - p.x, c.y - p.y) < 24);
    car.boxedT = boxed ? car.boxedT + dt : 0;
    car.windowT = G.copAtWindow ? car.windowT + dt : 0;
    if (car.boxedT > BUST.boxed) down('busted', 'BOXED IN. LIKE YOUR CAREER PROSPECTS.');
    else if (car.windowT > BUST.window) down('busted', 'PLEASE STEP OUT OF THE STOLEN VEHICLE');
  }
  // paint shop
  paintCd -= dt;
  if (
    P.car &&
    paintCd <= 0 &&
    hyp(p.x - PAINT.x, p.y - PAINT.y) < 16 &&
    (G.heat > 0 || P.car.hp < P.car.kind.hp - 5)
  ) {
    paintCd = 4;
    if (G.cash >= 200) {
      G.cash -= 200;
      G.heat = 0;
      G.heatPts = 0;
      P.car.hp = P.car.kind.hp;
      P.car.burn = 0;
      if (P.car.kind.col == null) P.car.col = pick(CCOLS.filter((c) => c !== P.car.col));
      sfx.good();
      msg('PAINT & PRAY: NEW COLOUR, SAME SINS. -$200');
    } else msg('PAINT & PRAY: NO CASH, NO ABSOLUTION.');
  }
  const dn = DISTRICTS[districtAt(p.x, p.y)];
  if (dn !== district) {
    district = dn;
    G.pops.push({ x: 0, y: 0, t: dn, col: 1, l: 2.5, hud: true });
  }
  newsT -= dt;
  if (newsT <= 0) {
    newsT = 22 + R() * 15;
    if (G.msgT <= 0) msg(forDifficulty(pick(NEWS)));
  }
}
