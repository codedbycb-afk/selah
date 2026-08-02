#!/usr/bin/env python3
"""Selah asset pipeline — cut out the pilgrim, mint every icon size.
Run:  python3 assets/build-assets.py   (from the repo root)"""
import os
from collections import deque
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
RAW  = os.path.join(HERE, "raw")
OUT  = HERE
BG   = (7, 7, 12)          # --bg #07070c


# ---------------------------------------------------------------- pilgrim
def cutout(src, dst, tol=26):
    """Flood the white studio background from the edges and drop it to alpha 0.
    Flooding (rather than a global colour key) protects the cream robe, which
    is close enough to white that a threshold alone would eat it."""
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()

    def white(p):
        return p[0] > 255 - tol and p[1] > 255 - tol and p[2] > 255 - tol

    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and white(px[x, y]):
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and white(px[x, y]):
                seen[y * w + x] = 1
                q.append((x, y))

    while q:
        x, y = q.popleft()
        px[x, y] = (255, 255, 255, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and white(px[nx, ny]):
                seen[ny * w + nx] = 1
                q.append((nx, ny))

    im = im.crop(im.getbbox())                       # trim to the figure
    im.thumbnail((360, 360), Image.LANCZOS)
    im.save(dst)
    print("pilgrim →", dst, im.size)
    return im


# ---------------------------------------------------------------- icons
def square_fill(src, size):
    """Full-bleed square on the app background — no white corners once iOS
    masks it to a squircle."""
    im = Image.open(src).convert("RGB")
    s = min(im.size)
    im = im.crop(((im.width - s) // 2, (im.height - s) // 2,
                  (im.width + s) // 2, (im.height + s) // 2))
    im = im.resize((size, size), Image.LANCZOS)
    # paint over any residual light corner from the source's rounded frame
    canvas = Image.new("RGB", (size, size), BG)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * 0.20), fill=255)
    canvas.paste(im, (0, 0), mask.filter(ImageFilter.GaussianBlur(size * 0.004)))
    return canvas


def maskable(src, size):
    """Android maskable: the safe zone is the middle 80%, so inset the art."""
    inner = int(size * 0.76)
    art = square_fill(src, inner)
    canvas = Image.new("RGB", (size, size), BG)
    canvas.paste(art, ((size - inner) // 2, (size - inner) // 2))
    return canvas


if __name__ == "__main__":
    cutout(os.path.join(RAW, "pilgrim-a.png"), os.path.join(OUT, "pilgrim.png"))

    for s in (1024, 512, 192, 180, 167, 152, 120, 32):
        square_fill(os.path.join(RAW, "icon-b.png"), s).save(
            os.path.join(OUT, f"icon-{s}.png"))
    maskable(os.path.join(RAW, "icon-b.png"), 512).save(
        os.path.join(OUT, "icon-maskable-512.png"))
    square_fill(os.path.join(RAW, "icon-b.png"), 32).save(
        os.path.join(OUT, "favicon.png"))
    print("icons → assets/icon-*.png")
