#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Make assets/icon-source.png from the owner's goose artwork (not in the repository).

    python3 tools/icon-source.py ARTWORK.jpg assets/icon-source.png

The artwork is Big Honk in sunglasses and a gold chain on a sunset, in a circle, on white. This keeps the circle,
makes the white round it transparent, and shrinks it to 360 x 360, twice the largest icon, for
tools/make-icons.mjs to draw the icons from. Needs Python 3 with Pillow, NumPy and OpenCV
(pip install pillow numpy opencv-python-headless).
"""
import sys
import numpy as np
import cv2
from PIL import Image

SRC, OUT, SIZE = sys.argv[1], sys.argv[2], 360

rgb = np.array(Image.open(SRC).convert('RGB'))
h, w, _ = rgb.shape
# The white round the circle: near-white pixels joined to the edge of the picture.
light = (rgb.min(axis=2) > 200).astype(np.uint8) * 255
mask = np.zeros((h + 2, w + 2), np.uint8)
for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
    if light[seed[1], seed[0]] == 255:
        cv2.floodFill(light, mask, seed, 128)
alpha = np.where(light == 128, 0, 255).astype(np.uint8)
# A soft edge, so the shrunk icon's round edge is smooth rather than stepped.
alpha = cv2.GaussianBlur(alpha, (0, 0), 2)
alpha[alpha < 8] = 0
# The circle's square, centred.
ys, xs = np.nonzero(alpha)
cx, cy, half = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2, max(xs.max() - xs.min(), ys.max() - ys.min()) / 2
box = tuple(int(round(v)) for v in (cx - half, cy - half, cx + half, cy + half))
rgba = np.dstack([rgb, alpha])
img = Image.fromarray(rgba, 'RGBA').crop(box)
# Shrink with the colours weighted by their alpha, so the white round the edge does not bleed in.
pre = np.array(img).astype(np.float32)
pre[..., :3] *= pre[..., 3:4] / 255
small = np.array(Image.fromarray(pre.astype(np.uint8), 'RGBA').resize((SIZE, SIZE), Image.LANCZOS)).astype(np.float32)
a = small[..., 3:4]
small[..., :3] = np.where(a > 0, np.clip(small[..., :3] * 255 / np.maximum(a, 1), 0, 255), 0)
Image.fromarray(small.round().astype(np.uint8), 'RGBA').save(OUT, optimize=True)
print('saved', OUT)
