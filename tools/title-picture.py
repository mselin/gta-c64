#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Make assets/title-sunset.png from the owner's sunset artwork (not in the repository).

    python3 tools/title-picture.py ARTWORK.jpg assets/title-sunset.png

The picture is 320 x 180, in the 16 C64 colours and double-wide pixels (assets/README.md), with "SLEAZEBURG 64" in
the game's own letters (js/glyphs.js) where the artwork had its logo, and the artwork's Commodore logo left out.
Needs Python 3 with Pillow, NumPy and OpenCV (pip install pillow numpy opencv-python-headless), and Node to read
the letters. Run it from the repository's root.
"""
import json, subprocess, sys
import numpy as np
import cv2
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
PAL = ['#000000', '#ffffff', '#68372b', '#70a4b2', '#6f3d86', '#588d43', '#352879', '#b8c76f',
       '#6f4f25', '#433900', '#9a6759', '#444444', '#6c6c6c', '#9ad284', '#6c5eb5', '#959595']
RGB = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in PAL], np.float32)
G = json.loads(subprocess.check_output(
    ['node', '-e', "import('./js/glyphs.js').then((m) => console.log(JSON.stringify(m.GLYPHS)))"]))
W, H = 320, 180

src = Image.open(SRC).convert('RGB')
img = np.array(src.resize((W, H), Image.LANCZOS)).astype(np.float32)
fixed = np.full((H, W), -1, np.int16)  # palette index already decided (the logo), or -1

# 1. The stripes under the old logo: the Commodore logo between them is replaced by the stripes either side.
for y in range(150, 178):
    img[y, 112:131] = img[y, 100]
    img[y, 131:152] = img[y, 168]

# 2. A black plate over the old letters, its corners cut.
x0, x1, y0, y1 = 60, 200, 82, 152
fixed[y0:y1, x0:x1] = 0
for (cx, cy) in ((x0, y0), (x1 - 1, y0), (x0, y1 - 1), (x1 - 1, y1 - 1)):
    for dy in range(2):
        for dx in range(2 - dy):
            fixed[cy + (dy if cy == y0 else -dy), cx + (dx if cx == x0 else -dx)] = -1

def glyph_mask(s, sx, sy, bold, gap):
    """The letters of s as a mask: each font pixel sx wide and sy tall, thickened by `bold` pixels to the right."""
    cell = (5 + bold + gap) * sx
    m = np.zeros((7 * sy, cell * len(s)), bool)
    for i, ch in enumerate(s):
        for r, row in enumerate(G[ch]):
            for b in range(5):
                if row & (16 >> b):
                    for t in range(bold + 1):
                        x = i * cell + (b + t) * sx
                        m[r * sy:(r + 1) * sy, x:x + sx] = True
    return m[:, :cell * len(s) - gap * sx]

def put(mask, left, top, fill):
    """Paint the letters, `fill(row)` giving each row's colour, with a black outline round them."""
    h, w = mask.shape
    out = np.zeros((H, W), bool)
    out[top:top + h, left:left + w] = mask
    ring = cv2.dilate(out.astype(np.uint8), np.ones((3, 5), np.uint8)).astype(bool) & ~out
    fixed[ring] = 0
    for y in range(H):
        xs = np.nonzero(out[y])[0]
        if len(xs):
            fixed[y, xs] = fill(y - top, h)

def stripes_blue(r, h):
    # White, with two blue stripes through the upper half, as the artwork's logo had.
    return 3 if r in (h // 4, h // 4 + 1) else 14 if r in (h // 2 - 1, h // 2) else 1

# Line 1: SLEAZEBURG, bold, each font pixel 2 wide and 3 tall.
m1 = glyph_mask('SLEAZEBURG', 2, 3, 1, 1)
put(m1, (x0 + x1) // 2 - m1.shape[1] // 2 & ~1, y0 + 4, stripes_blue)
# Line 2: a big 64, each font pixel 4 wide and 4 tall, in the sunset's yellow over orange.
m2 = glyph_mask('64', 4, 4, 1, 1)
l2 = (x0 + x1) // 2 - m2.shape[1] // 2 & ~1
t2 = y0 + 4 + 21 + 7
put(m2, l2, t2, lambda r, h: 7 if r < h // 2 else 10)
# Speed stripes either side of the 64: the sunset's colours, 3 rows each with a black row between.
for i, col in enumerate((7, 10, 4, 14, 6)):
    y = t2 + 2 + i * 5
    for yy in (y, y + 1, y + 2):
        fixed[yy, x0 + 6:l2 - 6] = col
        fixed[yy, l2 + m2.shape[1] + 6:x1 - 6] = col

# 3. Down to 160 x 180 (each pixel two wide), and to the C64 colours with a light ordered dither.
half = img.reshape(H, W // 2, 2, 3).mean(axis=2)
B = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16 - 0.47
lab = cv2.cvtColor((RGB[None] / 255).astype(np.float32), cv2.COLOR_RGB2Lab)[0]
out = np.zeros((H, W // 2), np.int16)
strength = 18
for y in range(H):
    for x in range(W // 2):
        f = fixed[y, 2 * x] if fixed[y, 2 * x] >= 0 else fixed[y, 2 * x + 1]
        if f >= 0:
            out[y, x] = f
            continue
        p = np.clip(half[y, x] + B[y % 4, x % 4] * strength, 0, 255)
        pl = cv2.cvtColor((p[None, None] / 255).astype(np.float32), cv2.COLOR_RGB2Lab)[0, 0]
        out[y, x] = int(np.argmin(((lab - pl) ** 2 * [1.3, 1, 1]).sum(axis=1)))
pic = RGB[np.repeat(out, 2, axis=1)].astype(np.uint8)
Image.fromarray(pic, 'RGB').save(OUT, optimize=True)
print('saved', OUT, pic.shape)
