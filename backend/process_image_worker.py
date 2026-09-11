#!/usr/bin/env python3
"""Sokchad — image whitening worker (Pillow).
Input:  argv[1] = source image path
Output: prints JSON {mode, bbox, out_path} to stdout; exit 0 on success.
Removes edge-connected background (flood fill from borders, tolerance vs corner seed),
keeps product pixels (shape/color/labels), centers product on white canvas with margin.
"""
import sys, json
from PIL import Image, ImageDraw
from collections import deque

def process(src_path, canvas_w=800, canvas_h=624, margin_ratio=0.04):
    src = Image.open(src_path).convert("RGB")
    w, h = src.size
    px = src.load()
    seed = px[0, 0]
    tol = 32

    visited = bytearray(w * h)
    q = deque([(0, 0)])
    visited[0] = 1
    dirs = ((1, 0), (-1, 0), (0, 1), (0, -1))
    while q:
        cx, cy = q.popleft()
        for dx, dy in dirs:
            nx, ny = cx + dx, cy + dy
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            idx = ny * w + nx
            if visited[idx]:
                continue
            p = px[nx, ny]
            if (abs(p[0]-seed[0]) <= tol and abs(p[1]-seed[1]) <= tol and abs(p[2]-seed[2]) <= tol):
                visited[idx] = 1
                q.append((nx, ny))

    whited = sum(visited)
    coverage = whited / (w * h)
    mode = "scene_preserved" if coverage > 0.92 else ("background_removed" if coverage > 0.02 else "no_change")

    dst = src.copy()
    draw = ImageDraw.Draw(dst)
    for y in range(h):
        base = y * w
        for x in range(w):
            if visited[base + x]:
                draw.point((x, y), fill=(255, 255, 255))

    # bbox of product pixels
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        base = y * w
        for x in range(w):
            if not visited[base + x]:
                if x < minx: minx = x
                if y < miny: miny = y
                if x > maxx: maxx = x
                if y > maxy: maxy = y

    out = dst
    if maxx > 0 and maxy > 0:
        pad = max(8, int(min(w, h) * margin_ratio))
        bw, bh = maxx - minx + 1, maxy - miny + 1
        scale = min((canvas_w - 2 * pad) / bw, (canvas_h - 2 * pad) / bh, 4.0)
        tw, th = int(bw * scale), int(bh * scale)
        canvas = Image.new("RGB", (canvas_w, canvas_h), (255, 255, 255))
        canvas.paste(dst.crop((minx, miny, maxx + 1, maxy + 1)).resize((tw, th), Image.LANCZOS),
                     ((canvas_w - tw) // 2, (canvas_h - th) // 2))
        out = canvas
    else:
        out = dst

    return mode, coverage, out

if __name__ == "__main__":
    src = sys.argv[1]
    dst = sys.argv[2]
    mode, coverage, out_img = process(src)
    out_img.save(dst, "PNG", optimize=True)
    print(json.dumps({"mode": mode, "coverage": coverage, "out_path": dst}))