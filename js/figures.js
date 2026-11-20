// SPDX-License-Identifier: GPL-2.0-or-later
// People on foot, seen from above: passers-by, police, scooter riders, cultists and the player.
// Each is a few plain shapes (shoulders, head, arms, legs) facing right. Every frame is the figure turned and
// sampled straight onto hard pixels: no smoothing, and every pixel one of the 16 colours. No drawing here, so
// the tests can check the frames themselves; sprites.js only paints them.

/** Every frame is FRAME pixels square: room for the figure turned any way round, an arm out, and its outlines. */
export const FRAME = 24;
/** How big a pixel of a figure is, in screen pixels: 2 draws people in chunky 2 x 2 blocks. */
export const CELL = 2;
/**
 * The outlines drawn round a figure once it is turned, innermost first: black for everyone, and round that,
 * for the player alone, a white one. Nobody else is ever drawn with white round them.
 */
export const OUTLINE = [0],
  PLAYER_OUTLINE = [0, 1];
/** What a police officer on foot wears: a light blue shirt, navy trousers and a white cap. */
export const COP = { shirt: 14, legs: 6, cap: 1 };
/** The darker palette colour that shades each colour: the back of the shoulders. */
export const SHADE = [0, 15, 9, 12, 6, 9, 0, 8, 9, 0, 2, 0, 11, 5, 6, 12];

/**
 * The poses. 0 to 4 are the walk: how far the left foot is ahead, from a full stride back to a full stride
 * forward, the right foot and the left hand the other way. 2 is standing. SHOOT and PUNCH put the right arm
 * straight out in front, with a gun or a fist at the end of it.
 */
export const STRIDES = [-1, -0.5, 0, 0.5, 1],
  STAND = 2,
  SHOOT = 5,
  PUNCH = 6,
  POSES = 7;
/** One step after another: a walking cycle of eight frames, each pose in turn, that swings back and forth. */
export const WALK_CYCLE = [2, 3, 4, 3, 2, 1, 0, 1];
/** Frames of the walking cycle per step taken, so a cycle is two steps: left foot, then right. */
export const FRAMES_PER_STEP = 4;
/** How long the arm stays out after a shot or a punch, in seconds. */
export const ARM_OUT_T = 0.2;

/** How someone is drawn: 'player', 'cop', 'scoot', 'cult', or 'civ' for everyone else. */
export const lookOf = (p) => (['player', 'cop', 'scoot', 'cult'].includes(p.type) ? p.type : 'civ');
/** The outlines for a person, innermost first. */
export const outlineOf = (p) => (lookOf(p) === 'player' ? PLAYER_OUTLINE : OUTLINE);
/** The walking pose `anim` steps into a walk. Standing still is anim 0: the middle pose. */
export const walkPose = (anim) => WALK_CYCLE[Math.floor(anim * FRAMES_PER_STEP) % WALK_CYCLE.length];
/** The pose to draw someone in now: arm out just after a shot or a punch, otherwise walking. */
export const poseOf = (p) => (p.armT > 0 ? p.arm : walkPose(p.anim));

/** True if (x, y) is within r of the line from (ax, ay) to (bx, by). */
function nearLine(x, y, ax, ay, bx, by, r) {
  const vx = bx - ax,
    vy = by - ay,
    t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
  return (x - ax - t * vx) ** 2 + (y - ay - t * vy) ** 2 <= r * r;
}

/**
 * The colour of a person at (x, y), in screen pixels from their middle, facing +x with +y on their right; -1
 * where there is nothing. Shapes are drawn in order, so a later one covers an earlier one.
 */
export function colourAt(p, pose, x, y) {
  const look = lookOf(p),
    walker = look !== 'scoot' && look !== 'cult',
    out = walker && (pose === SHOOT || pose === PUNCH),
    s = walker && !out ? STRIDES[pose] : 0,
    legs = p.legs ?? 11;
  let c = -1;
  const box = (x0, x1, y0, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const disc = (cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  // A scooter: the deck, a wheel at each end, and the handlebar across the front.
  if (look === 'scoot') {
    if (box(-7, 4, -1.2, 1.2)) c = 12;
    if (disc(-7, 0, 1.4) || disc(4.6, 0, 1.4)) c = 0;
    if (box(3, 4.2, -4.8, 4.8)) c = 12;
  }
  // Legs, stepping out in front and behind, in the trousers' colour. Only the feet show past the shoulders:
  // short limbs that stay close to the body, so a stride never reads as anything but a stride.
  if (walker)
    for (const side of [-1, 1]) {
      const f = -side * s * 3.4,
        fy = side * 1.9;
      if (box(Math.min(0, f) - 1, Math.max(0, f) + 1, fy - 1.1, fy + 1.1)) c = legs;
    }
  // Shoulders across, square with the corners cut, the back of them shaded. A cultist's robe is wider.
  const rx = look === 'cult' ? 3.4 : 2.4,
    ry = look === 'cult' ? 5 : 4.6;
  if (Math.abs(x) <= rx && Math.abs(y) <= ry && Math.abs(x) / rx + Math.abs(y) / ry <= 1.6)
    c = x < -0.8 ? SHADE[p.shirt] : p.shirt;
  // Arms: a sleeve and a hand. A walker's hands swing beside the body, opposite to the feet; a scooter
  // rider's hold the handlebar; a cultist's are held out in front. With the arm out, the right hand is far out
  // in front.
  for (const side of [-1, 1]) {
    let hx = side * s * 2.2,
      hy = side * 5;
    if (look === 'scoot') [hx, hy] = [3.6, side * 4.6];
    else if (look === 'cult') [hx, hy] = [3.8, side * 2.4];
    else if (out && side > 0) [hx, hy] = [7.2, 1.6];
    else if (out) [hx, hy] = [1.2, -4.4];
    if (nearLine(x, y, 0, side * 4, hx * 0.6, hy, 1.1)) c = p.shirt;
    if (disc(hx, hy, out && side > 0 && pose === PUNCH ? 1.6 : 1.3)) c = p.skin;
    if (out && side > 0 && pose === SHOOT && box(hx + 0.6, hx + 2.8, hy - 0.7, hy + 0.7)) c = 11;
  }
  // The head: hair, a police cap with its badge and black peak, or a hood; the face to the front.
  if (disc(0.6, 0, 2.7)) {
    if (look === 'cop') c = x > 2.4 ? 0 : disc(1.6, 0, 0.8) ? 7 : COP.cap;
    else if (look === 'cult') c = x > 2 ? p.skin : p.hair;
    else c = x > 1.5 ? p.skin : p.hair;
  }
  // A cultist's hood hangs down the back.
  if (look === 'cult' && box(-3, 0.6, -2.4, 2.4) && c !== -1) c = p.hair;
  return c;
}

/**
 * A person turned to `angle` (0 faces right; positive turns clockwise on screen), as FRAME x FRAME palette
 * indexes, -1 for empty: the figure sampled in `cell` x `cell` blocks, without its outlines.
 */
export function pixels(p, pose, angle, cell = CELL) {
  const S = FRAME,
    px = new Int8Array(S * S).fill(-1),
    cs = Math.cos(angle),
    sn = Math.sin(angle);
  for (let cy = 0; cy < S; cy += cell)
    for (let cx = 0; cx < S; cx += cell) {
      // Sample the middle of each block, turned back to the figure's own way round.
      const dx = cx + cell / 2 - S / 2,
        dy = cy + cell / 2 - S / 2,
        c = colourAt(p, pose, cs * dx + sn * dy, -sn * dx + cs * dy);
      if (c >= 0) for (let j = 0; j < cell; j++) for (let i = 0; i < cell; i++) px[(cy + j) * S + cx + i] = c;
    }
  return px;
}
/** The frame drawn on screen: the figure's pixels, then a one-pixel ring round them for each outline. */
export function frame(p, pose, angle, cell = CELL) {
  const S = FRAME,
    px = pixels(p, pose, angle, cell);
  for (const ring of outlineOf(p)) {
    const on = (x, y) => x >= 0 && y >= 0 && x < S && y < S && px[y * S + x] >= 0,
      add = [];
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) add.push(y * S + x);
    for (const i of add) px[i] = ring;
  }
  return px;
}
