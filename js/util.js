// SPDX-License-Identifier: GPL-2.0-or-later
// Small maths and random-number helpers.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v),
  mod = (a, n) => ((a % n) + n) % n,
  hyp = Math.hypot;
export const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const R = Math.random,
  pick = (a) => a[Math.floor(R() * a.length)];
export function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (x, y) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
/**
 * Break text into lines of at most n characters, at spaces. A word longer than a line is cut where the line
 * ends. Lines never start or end with a space, and none are empty.
 */
export function wrap(s, n) {
  const lines = [];
  let line = '';
  for (let w of String(s).split(' ').filter(Boolean)) {
    if (line && line.length + 1 + w.length <= n) {
      line += ' ' + w;
      continue;
    }
    if (line) lines.push(line);
    while (w.length > n) {
      lines.push(w.slice(0, n));
      w = w.slice(n);
    }
    line = w;
  }
  if (line) lines.push(line);
  return lines;
}
/** Like wrap, in as few lines, but with the lines as even as they go, so no word is left alone on a line. */
export function wrapEven(s, n) {
  const lines = wrap(s, n);
  // Never narrower than the longest word, so no word is cut that wrap would have kept whole.
  const words = String(s).split(' '),
    longest = Math.max(...words.map((w) => w.length));
  for (let w = Math.max(longest, Math.ceil(String(s).trim().length / lines.length)); w < n; w++) {
    const even = wrap(s, w);
    if (even.length === lines.length) return even;
  }
  return lines;
}
