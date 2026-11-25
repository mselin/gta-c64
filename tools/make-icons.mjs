// SPDX-License-Identifier: GPL-2.0-or-later
// Draws the game's icons, the ones a browser shows in its tab and a phone on its home screen, and writes them to
// assets/. Each is Big Honk, the goose, in sunglasses and a gold chain on a sunset, in a circle: the owner's
// artwork, kept in assets/icon-source.png (360 x 360, transparent round the circle; tools/icon-source.py makes it).
// The tab icons are transparent round the circle. The phone's is not, as a phone shows transparency as black: it
// has the circle's own deep purple round it, and a margin for the phone to round its corners off.
//
//   node tools/make-icons.mjs          writes the files
//   node tools/make-icons.mjs --check  only says whether the files are up to date (the tests use this)
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const SOURCE = new URL('../assets/icon-source.png', import.meta.url);
/** The circle's deep purple, round the phone's icon. */
export const BACKDROP = [37, 7, 98];

/** Read an 8-bit RGBA PNG, not interlaced (what tools/icon-source.py writes): { w, h, px } with 4 bytes a pixel. */
export function readPng(png) {
  const ihdr = {
    w: png.readUInt32BE(16),
    h: png.readUInt32BE(20),
    depth: png[24],
    type: png[25],
    lace: png[28],
  };
  if (ihdr.depth !== 8 || ihdr.type !== 6 || ihdr.lace !== 0)
    throw new Error('icon-source.png: not 8-bit RGBA');
  const parts = [];
  for (let pos = 8; pos < png.length;) {
    const len = png.readUInt32BE(pos);
    if (png.subarray(pos + 4, pos + 8).toString('latin1') === 'IDAT')
      parts.push(png.subarray(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(parts)),
    { w, h } = ihdr,
    stride = w * 4,
    px = Buffer.alloc(w * h * 4);
  // Undo each row's filter (PNG's five), from the row above, already undone.
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)],
      row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? px[y * stride + i - 4] : 0,
        b = y > 0 ? px[(y - 1) * stride + i] : 0,
        c = i >= 4 && y > 0 ? px[(y - 1) * stride + i - 4] : 0;
      let v = row[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + i] = v & 255;
    }
  }
  return { w, h, px };
}

/**
 * The picture shrunk to n x n: each new pixel the average of the source pixels it covers, part pixels in part,
 * the colours weighted by their opacity so that the transparent edge does not darken them.
 */
export function shrink({ w, h, px }, n) {
  const out = new Float64Array(n * n * 4),
    spans = (len) =>
      Array.from({ length: n }, (_, t) => {
        const a = (t * len) / n,
          b = ((t + 1) * len) / n,
          cover = [];
        for (let s = Math.floor(a); s < Math.ceil(b); s++)
          cover.push([s, Math.min(b, s + 1) - Math.max(a, s)]);
        return cover;
      }),
    xs = spans(w),
    ys = spans(h);
  for (let ty = 0; ty < n; ty++)
    for (let tx = 0; tx < n; tx++) {
      let r = 0,
        g = 0,
        b = 0,
        al = 0,
        area = 0;
      for (const [sy, wy] of ys[ty])
        for (const [sx, wx] of xs[tx]) {
          const o = (sy * w + sx) * 4,
            k = wx * wy,
            a = px[o + 3] / 255;
          r += px[o] * a * k;
          g += px[o + 1] * a * k;
          b += px[o + 2] * a * k;
          al += a * k;
          area += k;
        }
      const o = (ty * n + tx) * 4;
      out[o] = al ? r / al : 0;
      out[o + 1] = al ? g / al : 0;
      out[o + 2] = al ? b / al : 0;
      out[o + 3] = (al / area) * 255;
    }
  return out;
}

/** An 8-bit PNG of n x n pixels: RGBA, or RGB over `backdrop` with `pad` pixels of it round the picture. */
export function png(pic, n, { backdrop = null, pad = 0 } = {}) {
  const size = n + 2 * pad,
    ch = backdrop ? 3 : 4,
    raw = Buffer.alloc(size * (size * ch + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const inside = x >= pad && y >= pad && x < pad + n && y < pad + n,
        o = ((y - pad) * n + (x - pad)) * 4,
        a = inside ? pic[o + 3] / 255 : 0,
        at = y * (size * ch + 1) + 1 + x * ch;
      for (let i = 0; i < 3; i++) {
        const c = inside ? pic[o + i] : 0;
        raw[at + i] = Math.round(backdrop ? c * a + backdrop[i] * (1 - a) : c);
      }
      if (!backdrop) raw[at + 3] = Math.round(a * 255);
    }
  const chunk = (type, body) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, 'latin1');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head.set([8, backdrop ? 2 : 6, 0, 0, 0], 8); // 8 bits, RGB or RGBA, not interlaced
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/**
 * Whether two PNG files hold the same picture: the same header and the same pixels once unpacked. (Comparing the
 * files byte for byte would not do: another version of zlib may pack the same pixels differently.)
 */
export function samePicture(a, b) {
  const unpack = (png) => {
    const parts = { IHDR: [], IDAT: [] };
    for (let pos = 8; pos < png.length;) {
      const len = png.readUInt32BE(pos),
        type = png.subarray(pos + 4, pos + 8).toString('latin1');
      parts[type]?.push(png.subarray(pos + 8, pos + 8 + len));
      pos += 12 + len;
    }
    return Buffer.concat([...parts.IHDR, inflateSync(Buffer.concat(parts.IDAT))]);
  };
  try {
    return unpack(a).equals(unpack(b));
  } catch (e) {
    return false;
  }
}

/** Every icon file, by its path under the game's folder. */
export function icons() {
  const src = readPng(readFileSync(SOURCE));
  return {
    'assets/icon-16.png': png(shrink(src, 16), 16),
    'assets/icon-32.png': png(shrink(src, 32), 32),
    // A phone rounds the corners of a home-screen icon off: the circle sits inside a margin of the backdrop.
    'assets/icon-180.png': png(shrink(src, 168), 168, { backdrop: BACKDROP, pad: 6 }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('../', import.meta.url),
    check = process.argv.includes('--check');
  let stale = 0;
  for (const [path, bytes] of Object.entries(icons())) {
    const url = new URL(path, root);
    let same = false;
    try {
      same = samePicture(readFileSync(url), bytes);
    } catch (e) {
      /* missing */
    }
    if (same) continue;
    if (check) {
      console.log(`${path} is out of date: run node tools/make-icons.mjs`);
      stale++;
    } else {
      writeFileSync(url, bytes);
      console.log(`wrote ${path}`);
    }
  }
  process.exit(stale ? 1 : 0);
}
