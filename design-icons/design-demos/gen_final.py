
# -*- coding: utf-8 -*-
"""house-hub app icon FINAL — direction 2b: 收敛环 · 深底."""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(os.path.dirname(os.path.dirname(OUT)),
                   'apps', 'shell', 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'res')

def h2r(x):
    x = x.lstrip('#')
    return tuple(int(x[i:i + 2], 16) for i in (0, 2, 4))

BG_IN, BG_OUT = h2r('#0F3A4E'), h2r('#030C14')
R_OUT, R_MID, R_IN = h2r('#E9F3FA'), h2r('#DCEAF4'), h2r('#1FD3B6')
DOT = h2r('#FFC062')

def radial(size, c1, c2, cx=0.32, cy=0.20, rad=1.05):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    d = np.sqrt((xs / size - cx) ** 2 + (ys / size - cy) ** 2) / rad
    t = np.clip(d, 0, 1)
    col = np.zeros((size, size, 3), np.float32)
    c1, c2 = np.array(c1, np.float32), np.array(c2, np.float32)
    for i in range(3):
        col[..., i] = c1[i] + (c2[i] - c1[i]) * t
    return Image.fromarray(col.astype(np.uint8), 'RGB').convert('RGBA')

def ring(d, cx, cy, r, w, gap_center, gap, fill):
    w = max(1, int(round(w)))
    a0 = (gap_center + gap / 2.0) % 360
    a1 = (gap_center - gap / 2.0) % 360
    segs = [(a0, a1)] if a0 < a1 else [(a0, 360.0), (0.0, a1)]
    for s, e in segs:
        d.arc([cx - r, cy - r, cx + r, cy + r], s, e, fill=fill, width=w)
    for ang in (a0, a1):
        a = math.radians(ang)
        ex, ey = cx + r * math.cos(a), cy + r * math.sin(a)
        hw = w / 2.0
        d.ellipse([ex - hw, ey - hw, ex + hw, ey + hw], fill=fill)

def marks(S, scale, mono=False):
    """concentric收敛环, in a 1024-design scaled to canvas S"""
    L = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    k = S / 1024.0 * scale
    cx = cy = S / 2.0
    if mono:
        cols = [(255, 255, 255, 255)] * 3 + [(255, 255, 255, 255)]
    else:
        cols = [R_OUT + (236,), R_MID + (196,), R_IN + (255,)]
    ring(d, cx, cy, 306 * k, 44 * k, 42, 44, cols[0])
    ring(d, cx, cy, 212 * k, 44 * k, 42, 62, cols[1])
    ring(d, cx, cy, 118 * k, 44 * k, 42, 82, cols[2])
    dotc = (255, 255, 255, 255) if mono else DOT + (255,)
    d.ellipse([cx - 30 * k, cy - 30 * k, cx + 30 * k, cy + 30 * k], fill=dotc)
    return L

def ss_for(px):
    return 4 if px <= 200 else (3 if px <= 512 else 2)

def background(px):
    S = px * ss_for(px)
    return radial(S, BG_IN, BG_OUT).resize((px, px), Image.LANCZOS)

def foreground(px, mono=False):
    # adaptive: key content inside the 66dp safe circle of the 108dp canvas
    S = px * ss_for(px)
    return marks(S, 0.9146, mono).resize((px, px), Image.LANCZOS)

def full_icon(px, shape='round_rect', mark_scale=1.0):
    S = px * ss_for(px)
    base = radial(S, BG_IN, BG_OUT)
    base.alpha_composite(marks(S, mark_scale))
    m = Image.new('L', (S, S), 0)
    dm = ImageDraw.Draw(m)
    if shape == 'circle':
        dm.ellipse([0, 0, S - 1, S - 1], fill=255)
    else:
        dm.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(base, (0, 0), m)
    return out.resize((px, px), Image.LANCZOS)

# ---- output ----
os.makedirs(RES, exist_ok=True)
DENS = [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216),
        ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]
written = []
for dpi, legacy_px, layer_px in DENS:
    d = os.path.join(RES, 'mipmap-' + dpi)
    os.makedirs(d, exist_ok=True)
    full_icon(legacy_px, 'round_rect').save(os.path.join(d, 'ic_launcher.png'))
    full_icon(legacy_px, 'circle').save(os.path.join(d, 'ic_launcher_round.png'))
    background(layer_px).save(os.path.join(d, 'ic_launcher_background.png'))
    foreground(layer_px).save(os.path.join(d, 'ic_launcher_foreground.png'))
    foreground(layer_px, mono=True).save(os.path.join(d, 'ic_launcher_monochrome.png'))
    written.append(dpi)

# store / showcase
final_dir = os.path.join(os.path.dirname(OUT), 'final')
os.makedirs(final_dir, exist_ok=True)
full_icon(512, 'round_rect').save(os.path.join(final_dir, 'icon-512.png'))
full_icon(1024, 'round_rect').save(os.path.join(final_dir, 'icon-1024.png'))
background(1024).save(os.path.join(final_dir, 'layer-background-1024.png'))
foreground(1024).save(os.path.join(final_dir, 'layer-foreground-1024.png'))

# adaptive preview: 圆形遮罩 + 浅色底，模拟启动器
P = 1200
prev = Image.new('RGB', (P, 560), (238, 243, 248))
bd = ImageDraw.Draw(prev)
fb = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 40)
fs = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 26)
bd.text((60, 48), 'house-hub 图标定稿 · 方向二 收敛环（深海底）', font=fb, fill=(17, 30, 51))
bd.text((60, 104), '左：启动器圆形遮罩下的自适应图标　中：方形遮罩　右：48px 实际大小', font=fs, fill=(110, 126, 145))
bg_l = background(432); fg_l = foreground(432)
adaptive = bg_l.copy(); adaptive.alpha_composite(fg_l)
for i, (shape, cx) in enumerate([('circle', 300), ('round_rect', 560)]):
    m = Image.new('L', (432, 432), 0)
    dm = ImageDraw.Draw(m)
    if shape == 'circle':
        dm.ellipse([0, 0, 431, 431], fill=255)
    else:
        dm.rounded_rectangle([0, 0, 431, 431], radius=95, fill=255)
    tile = Image.new('RGBA', (432, 432), (0, 0, 0, 0))
    tile.paste(adaptive, (0, 0), m)
    tile = tile.resize((300, 300), Image.LANCZOS)
    prev.paste(tile, (cx - 150, 180), tile)
small = full_icon(48, 'round_rect')
prev.paste(small, (860, 306), small)
bd.text((820, 372), '48px', font=fs, fill=(110, 126, 145))
prev.save(os.path.join(final_dir, 'adaptive-preview.png'))
print('done', written)
