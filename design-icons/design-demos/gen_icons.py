
# -*- coding: utf-8 -*-
"""house-hub app icon candidates — 3 directions x 2 tone variants."""
import os, math, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SS = 3
BASE = 1024
S = BASE * SS
OUT = os.path.dirname(os.path.abspath(__file__))
FONT_BD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_RG = "C:/Windows/Fonts/msyh.ttc"

def h2r(x):
    x = x.lstrip('#')
    return tuple(int(x[i:i+2], 16) for i in (0, 2, 4))

def lin_grad(size, c1, c2, angle=135.0):
    w = h = size
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(angle)
    t = xs * math.cos(a) + ys * math.sin(a)
    t = (t - t.min()) / (t.max() - t.min() + 1e-9)
    col = np.zeros((h, w, 3), np.float32)
    c1, c2 = np.array(c1, np.float32), np.array(c2, np.float32)
    for i in range(3):
        col[..., i] = c1[i] + (c2[i] - c1[i]) * t
    return Image.fromarray(col.astype(np.uint8), 'RGB')

def radial_grad(size, c1, c2, cx=0.28, cy=0.22, radius=1.15):
    w = h = size
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xs / w - cx) ** 2) + ((ys / h - cy) ** 2)) / radius
    t = np.clip(d, 0, 1)
    col = np.zeros((h, w, 3), np.float32)
    c1, c2 = np.array(c1, np.float32), np.array(c2, np.float32)
    for i in range(3):
        col[..., i] = c1[i] + (c2[i] - c1[i]) * t
    return Image.fromarray(col.astype(np.uint8), 'RGB')

def canvas(grad):
    im = grad.convert('RGBA')
    return im

def layer():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))

def pill(d, x0, y0, x1, y1, r, fill):
    d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill)

def ring(d, cx, cy, r, width, gap_center, gap, fill):
    """arc with rounded caps; gap_center/gap in degrees, 0 = 3 o'clock, clockwise"""
    a0 = (gap_center + gap / 2.0) % 360
    a1 = (gap_center - gap / 2.0) % 360
    segs = [(a0, a1)] if a0 < a1 else [(a0, 360.0), (0.0, a1)]
    for s, e in segs:
        d.arc([cx - r, cy - r, cx + r, cy + r], s, e, fill=fill, width=width)
    for ang in (a0, a1):
        a = math.radians(ang)
        ex, ey = cx + r * math.cos(a), cy + r * math.sin(a)
        hw = width / 2.0
        d.ellipse([ex - hw, ey - hw, ex + hw, ey + hw], fill=fill)

def glow(img, radius):
    return img.filter(ImageFilter.GaussianBlur(radius))

# ---------- palettes ----------
DEEP1, DEEP2 = h2r('#04121B'), h2r('#0B2836')
DEEP3, DEEP4 = h2r('#060F19'), h2r('#0D2536')
PAPER1, PAPER2 = h2r('#FFFFFF'), h2r('#E4EDF5')
PAPER1b, PAPER2b = h2r('#F7FAFD'), h2r('#E1EAF3')
CYAN, CYAN_D = h2r('#1FD3B6'), h2r('#12A08C')
AMBER, AMBER_D = h2r('#FFC062'), h2r('#F09030')
INK, TEAL_INK = h2r('#123049'), h2r('#0E6E7A')
ACCENT = h2r('#0284C7')

def variant_gate(dark=True):
    if dark:
        base = canvas(lin_grad(S, DEEP1, DEEP2, 125))
        cy1, cy2 = CYAN, CYAN_D
        am1, am2 = AMBER, AMBER_D
        gate_c = (*PAPER1b, 240)
    else:
        base = canvas(lin_grad(S, PAPER1, PAPER2, 125))
        cy1, cy2 = h2r('#1FBBA5'), h2r('#0E8C80')
        am1, am2 = h2r('#F2A03E'), h2r('#D9822B')
        gate_c = (*INK, 235)
    L = layer(); d = ImageDraw.Draw(L)
    # commute bars, right-aligned at the 90-min gate
    gx = 598 * SS                                  # bars stop short of the gate
    barA = (300 * SS, 372 * SS, gx, 480 * SS)      # shorter trip
    barB = (238 * SS, 548 * SS, gx, 656 * SS)      # longer trip
    # soft shadow under bars
    sh = layer(); ds = ImageDraw.Draw(sh)
    pill(ds, barA[0], barA[1] + 10 * SS, barA[2], barA[3] + 10 * SS, 54 * SS, (0, 0, 0, 90))
    pill(ds, barB[0], barB[1] + 10 * SS, barB[2], barB[3] + 10 * SS, 54 * SS, (0, 0, 0, 90))
    base.alpha_composite(glow(sh, 14 * SS))
    # bars with vertical gradient
    for (x0, y0, x1, y1), c1, c2 in ((barA, cy1, cy2), (barB, am1, am2)):
        g = lin_grad(S, c1, c2, 90).convert('RGBA')
        m = Image.new('L', (S, S), 0)
        ImageDraw.Draw(m).rounded_rectangle([x0, y0, x1, y1], radius=54 * SS, fill=255)
        L.paste(g, (0, 0), m)
    # the gate
    pill(d, 624 * SS, 300 * SS, 652 * SS, 728 * SS, 14 * SS, gate_c)
    base.alpha_composite(L)
    return base

def variant_rings(dark=False):
    if dark:
        base = canvas(radial_grad(S, h2r('#0C2C3A'), h2r('#04101A'), 0.3, 0.2, 1.1))
        c_out, c_mid, c_in = (*h2r('#E6F1F8'), 235), (*h2r('#E6F1F8'), 200), CYAN + (255,)
        dot = (*AMBER, 255)
    else:
        base = canvas(radial_grad(S, PAPER1, PAPER2, 0.3, 0.2, 1.1))
        c_out, c_mid, c_in = (*INK, 240), (*INK, 205), ACCENT + (255,)
        dot = (*AMBER, 255)
    L = layer(); d = ImageDraw.Draw(L)
    cx = cy = 512 * SS
    ring(d, cx, cy, 306 * SS, 44 * SS, 42, 44, c_out)
    ring(d, cx, cy, 212 * SS, 44 * SS, 42, 62, c_mid)
    ring(d, cx, cy, 118 * SS, 44 * SS, 42, 82, c_in)
    d.ellipse([cx - 30 * SS, cy - 30 * SS, cx + 30 * SS, cy + 30 * SS], fill=dot)
    base.alpha_composite(L)
    return base

def variant_pick(dark=True):
    if dark:
        base = canvas(lin_grad(S, DEEP3, DEEP4, 115))
        dot_c = (58, 92, 116, 255)
        hi1, hi2 = AMBER, AMBER_D
    else:
        base = canvas(lin_grad(S, PAPER1b, PAPER2b, 115))
        dot_c = (154, 176, 195, 255)
        hi1, hi2 = h2r('#2AA6DA'), ACCENT
    L = layer(); d = ImageDraw.Draw(L)
    pitch = 132 * SS
    cx = cy = 512 * SS
    hit = (1, 3)  # row, col  (5x5 = 25 quality items)
    hx = cx + (hit[1] - 2) * pitch
    hy = cy + (hit[0] - 2) * pitch
    # glow behind the chosen cell
    g = layer(); dg = ImageDraw.Draw(g)
    dg.rounded_rectangle([hx - 62 * SS, hy - 62 * SS, hx + 62 * SS, hy + 62 * SS], radius=30 * SS, fill=(*hi1, 110))
    base.alpha_composite(glow(g, 26 * SS))
    for r_ in range(5):
        for c_ in range(5):
            if (r_, c_) == hit:
                continue
            x = cx + (c_ - 2) * pitch
            y = cy + (r_ - 2) * pitch
            d.ellipse([x - 17 * SS, y - 17 * SS, x + 17 * SS, y + 17 * SS], fill=dot_c)
    gm = lin_grad(S, hi1, hi2, 90).convert('RGBA')
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([hx - 48 * SS, hy - 48 * SS, hx + 48 * SS, hy + 48 * SS], radius=26 * SS, fill=255)
    L.paste(gm, (0, 0), m)
    base.alpha_composite(L)
    return base

SPECS = [
    ("1a", "方向一 · 闸门", "1a 深海底", lambda: variant_gate(True)),
    ("1b", "方向一 · 闸门", "1b 纸底", lambda: variant_gate(False)),
    ("2a", "方向二 · 收敛环", "2a 纸底", lambda: variant_rings(False)),
    ("2b", "方向二 · 收敛环", "2b 深底", lambda: variant_rings(True)),
    ("3a", "方向三 · 拾一", "3a 深底琥珀", lambda: variant_pick(True)),
    ("3b", "方向三 · 拾一", "3b 纸底青", lambda: variant_pick(False)),
]

masters = {}
for key, dirname, cap, fn in SPECS:
    im = fn()
    big = im.convert('RGB').resize((BASE, BASE), Image.LANCZOS)
    p = os.path.join(OUT, 'icon-%s.png' % key)
    big.save(p)
    masters[key] = big
    small = big.resize((48, 48), Image.LANCZOS)
    small.save(os.path.join(OUT, 'icon-%s-48.png' % key))

# ---------- contact sheet ----------
W, H = 1680, 1240
sheet = Image.new('RGB', (W, H), (247, 248, 250))
sd = ImageDraw.Draw(sheet)
fb = ImageFont.truetype(FONT_BD, 40)
fs = ImageFont.truetype(FONT_RG, 26)
fk = ImageFont.truetype(FONT_RG, 22)
sd.text((70, 52), 'house-hub  App 图标 · 三方向六候选', font=fb, fill=(17, 30, 51))
sd.text((70, 108), '选房台 · 90 分钟通勤硬筛 / 片区收敛 / 25 项品质 · 一屏 6 个草案，挑一个方向后再做安卓自适应切图', font=fs, fill=(110, 126, 145))

def rounded(im, r=88):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], radius=r, fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out

CELLW, CELLH = 520, 470
x0, y0 = 70, 170
order = [["1a", "1b"], ["2a", "2b"], ["3a", "3b"]]
for col, keys in enumerate(order):
    for row, key in enumerate(keys):
        cx = x0 + col * CELLW
        cy = y0 + row * CELLH
        tile = rounded(masters[key]).resize((340, 340), Image.LANCZOS)
        sh = Image.new('RGBA', (360, 360), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([10, 16, 350, 356], radius=76, fill=(20, 40, 60, 28))
        sh = sh.filter(ImageFilter.GaussianBlur(12))
        sheet.paste(sh, (cx + 80, cy + 6), sh)
        sheet.paste(tile, (cx + 90, cy), tile)
        cap = dict((s[0], s[2]) for s in SPECS)[key]
        sd.text((cx + 90, cy + 366), cap, font=fk, fill=(17, 30, 51))

# 小尺寸可读性检查带
sy = 170 + 2 * CELLH + 46
sd.text((70, sy - 34), '小尺寸预览（48 / 72 px）', font=fk, fill=(110, 126, 145))
sx = 70
for key, dirname, cap, fn in SPECS:
    for sz in (48, 72):
        t = rounded(masters[key]).resize((sz, sz), Image.LANCZOS)
        sheet.paste(t, (sx, sy), t)
        sx += sz + 14
    sx += 30
sheet.save(os.path.join(OUT, 'contact-sheet.png'))
print('ok', json.dumps(list(masters)), 'sheet', sheet.size)
