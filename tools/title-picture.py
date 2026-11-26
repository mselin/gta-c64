#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Make assets/title-sunset.png from the owner's Sleazeburg 64 sunset artwork (not in the repository).

    python3 tools/title-picture.py ARTWORK.jpg assets/title-sunset.png

The artwork (1500 x 844) has the SLEAZEBURG 64 logo on a plate, with stripe bars under it and the Commodore logo
in a gap between them. That logo is left out: the stripes either side are carried across the gap. Then the
picture is made 320 x 180, in the 16 C64 colours and double-wide pixels (assets/README.md), with a light ordered
dither. Needs Python 3 with Pillow, NumPy and OpenCV (pip install pillow numpy opencv-python-headless).
"""
import sys
import numpy as np
import cv2
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
PAL = ['#000000', '#ffffff', '#68372b', '#70a4b2', '#6f3d86', '#588d43', '#352879', '#b8c76f',
       '#6f4f25', '#433900', '#9a6759', '#444444', '#6c6c6c', '#9ad284', '#6c5eb5', '#959595']
RGB = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in PAL], np.float32)
W, H = 320, 180

art = np.array(Image.open(SRC).convert('RGB'))
assert art.shape[:2] == (844, 1500), 'expected the 1500 x 844 artwork'
# The Commodore logo, in the gap between the stripe bars under the plate: the stripes just left of the gap,
# copied across it.
GAP_X0, GAP_X1, GAP_Y0, GAP_Y1 = 640, 746, 716, 800
w = GAP_X1 - GAP_X0
art[GAP_Y0:GAP_Y1, GAP_X0:GAP_X1] = art[GAP_Y0:GAP_Y1, GAP_X0 - w:GAP_X1 - w]

# To the C64's size, each pixel two wide, and to its colours, with a light ordered dither.
small = np.array(Image.fromarray(art).resize((W, H), Image.LANCZOS)).astype(np.float32)
half = small.reshape(H, W // 2, 2, 3).mean(axis=2)
B = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16 - 0.47
lab = cv2.cvtColor((RGB[None] / 255).astype(np.float32), cv2.COLOR_RGB2Lab)[0]
out = np.zeros((H, W // 2), np.int16)
for y in range(H):
    for x in range(W // 2):
        p = np.clip(half[y, x] + B[y % 4, x % 4] * 18, 0, 255)
        pl = cv2.cvtColor((p[None, None] / 255).astype(np.float32), cv2.COLOR_RGB2Lab)[0, 0]
        out[y, x] = int(np.argmin(((lab - pl) ** 2 * [1.3, 1, 1]).sum(axis=1)))
pic = RGB[np.repeat(out, 2, axis=1)].astype(np.uint8)
Image.fromarray(pic, 'RGB').save(OUT, optimize=True)
print('saved', OUT, pic.shape)
