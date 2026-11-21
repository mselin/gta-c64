// SPDX-License-Identifier: GPL-2.0-or-later
// People on foot, seen from above: passers-by, police, scooter riders, cultists and the player; and Big Honk.
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
 * forward, the right foot and the left hand the other way. 2 is standing. SHOOT, PUNCH and STAB put the right
 * arm straight out in front, with a gun, a fist or a knife at the end of it. DOWN is knocked flat on their back.
 */
export const STRIDES = [-1, -0.5, 0, 0.5, 1],
  STAND = 2,
  SHOOT = 5,
  PUNCH = 6,
  STAB = 7,
  DOWN = 8,
  POSES = 9;
/**
 * Big Honk's own poses, after everyone's: wings out to the sides and wings swept back, which he flaps between
 * when something would have hurt anyone else (FLAP_T seconds, FLAP_RATE beats a second), and afloat.
 */
export const FLAP_OUT = 9,
  FLAP_BACK = 10,
  FLOAT = 11,
  HONK_POSES = 12,
  FLAP_RATE = 12;
/** One step after another: a walking cycle of eight frames, each pose in turn, that swings back and forth. */
export const WALK_CYCLE = [2, 3, 4, 3, 2, 1, 0, 1];
/** Frames of the walking cycle per step taken, so a cycle is two steps: left foot, then right. */
export const FRAMES_PER_STEP = 4;
/** How long the arm stays out after a shot, a punch or a stab, in seconds. */
export const ARM_OUT_T = 0.2;

/** How someone is drawn: 'player', 'cop', 'scoot', 'cult', 'honk', or 'civ' for everyone else. */
export const lookOf = (p) => (['player', 'cop', 'scoot', 'cult', 'honk'].includes(p.type) ? p.type : 'civ');
/** The outlines for a person, innermost first. */
export const outlineOf = (p) => (lookOf(p) === 'player' ? PLAYER_OUTLINE : OUTLINE);
/** The walking pose `anim` steps into a walk. Standing still is anim 0: the middle pose. */
export const walkPose = (anim) => WALK_CYCLE[Math.floor(anim * FRAMES_PER_STEP) % WALK_CYCLE.length];
/**
 * The pose to draw someone in now: flat out if knocked down, arm out just after a blow, otherwise walking. Big
 * Honk has his own: flapping, afloat, or walking.
 */
export const poseOf = (p) => {
  if (p.type === 'honk')
    return p.flap > 0
      ? Math.floor(p.flap * FLAP_RATE) & 1
        ? FLAP_OUT
        : FLAP_BACK
      : p.swim
        ? FLOAT
        : walkPose(p.anim);
  return p.ko > 0 ? DOWN : p.armT > 0 ? p.arm : walkPose(p.anim);
};

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
  if (p.type === 'honk') return gooseAt(pose, x, y);
  const look = lookOf(p);
  if (pose === DOWN) return lyingAt(p, look, x, y);
  const walker = look !== 'scoot' && look !== 'cult',
    out = walker && (pose === SHOOT || pose === PUNCH || pose === STAB),
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
    // A dark grey gun, or a white blade that shows on pavement and road alike.
    if (out && side > 0 && pose !== PUNCH && box(hx + 0.6, hx + 2.8, hy - 0.7, hy + 0.7))
      c = pose === SHOOT ? 11 : 1;
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
 * Someone knocked flat on their back, head to the front: legs out straight behind, arms flung wide, face up with
 * the hair or cap at the crown. A cultist's robe covers their legs; a scooter rider's scooter lies beside them.
 */
function lyingAt(p, look, x, y) {
  let c = -1;
  const box = (x0, x1, y0, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const disc = (cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  if (look === 'scoot') {
    if (box(-6, 4, 5.2, 6.8)) c = 12;
    if (disc(-6, 6, 1.2) || disc(4, 6, 1.2)) c = 0;
  }
  if (look !== 'cult')
    for (const side of [-1, 1]) if (box(-8, -2, side * 1.7 - 1.1, side * 1.7 + 1.1)) c = p.legs ?? 11;
  if (box(look === 'cult' ? -8 : -2.6, 3, -3.4, 3.4)) c = p.shirt;
  for (const side of [-1, 1]) {
    if (nearLine(x, y, 2, side * 3, 3.6, side * 6, 1.1)) c = p.shirt;
    if (disc(3.8, side * 6.4, 1.2)) c = p.skin;
  }
  if (disc(5.4, 0, 2.4))
    c = x > 6.2 ? (look === 'cop' ? COP.cap : p.hair) : look === 'cult' && Math.abs(y) > 1 ? p.hair : p.skin;
  return c;
}

/**
 * Big Honk, Sleazeburg's crime boss: a white goose seen from above, in black sunglasses and a gold chain,
 * facing +x like everyone else. Laid out on the 2 x 2 blocks, back to front: a grey tail, the body with its
 * wings folded along the back in grey, the chain, the neck, the shades (wider than his head), the front of his
 * head and an orange beak. Walking, his orange feet paddle out at the sides; afloat they do not show. Flapping,
 * his wings go out to the sides and then back, and his beak opens wide.
 */
function gooseAt(pose, x, y) {
  const box = (x0, x1, y0, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
    flap = pose === FLAP_OUT || pose === FLAP_BACK,
    ay = Math.abs(y);
  let c = -1;
  if (pose === FLAP_OUT && ay >= 4 && ay <= 10 && box(-4, 0, -10, 10)) c = ay > 8 ? 15 : 1;
  if (pose === FLAP_BACK && ay >= 4 && ay <= 9 && Math.abs(x + 2 + (ay - 4) * 0.8) <= 2) c = ay > 7 ? 15 : 1;
  if (!flap && pose !== FLOAT)
    for (const side of [-1, 1]) {
      const f = -3 - side * (STRIDES[pose] ?? 0) * 2;
      if (box(f - 1, f + 1, side * 5 - 1, side * 5 + 1)) c = 8;
    }
  if (box(-8, -6, -2, 2)) c = 15;
  if (box(-6, 0, -4, 4) && Math.abs(x + 3) / 3 + ay / 4 <= 1.6) c = !flap && x < -2 && ay > 2 ? 15 : 1;
  if (box(0, 2, -2, 2)) c = 7;
  if (box(2, 4, -2, 2)) c = 1;
  if (box(4, 6, -4, 4)) c = 0;
  if (box(6, 8, -2, 2)) c = 1;
  if (box(8, 10, flap ? -3 : -1.5, flap ? 3 : 1.5)) c = 8;
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
