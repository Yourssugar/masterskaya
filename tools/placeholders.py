"""Заглушки картинок для каркаса сайта.

Рисует файлы с теми же путями, что в задании для Codex, только сразу в webp
в папку img/. Когда придут настоящие картинки, их нужно прогнать через
tools/convert.py, и они лягут поверх заглушек.

Запуск из корня проекта: python tools/placeholders.py
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "img")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
random.seed(7)


def font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default()


def save(im, rel, mobile_w=None):
    path = os.path.join(ROOT, rel + ".webp")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=82, method=5)
    if mobile_w:
        k = mobile_w / im.width
        sm = im.resize((mobile_w, round(im.height * k)), Image.LANCZOS)
        sm.save(os.path.join(ROOT, rel + "-m.webp"), "WEBP", quality=80, method=5)


def label(d, xy, text, size=56, fill=(255, 255, 255, 150)):
    d.text(xy, text, font=font(size), fill=fill, anchor="mm")


# ---------- фоны ----------

def table_plate(w, h, wall_top, wall_bot, wood, light=None, lamp=None, glow=None, tag=""):
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    table_y = int(h * 0.70)
    for y in range(table_y):
        t = y / table_y
        c = tuple(int(wall_top[i] * (1 - t) + wall_bot[i] * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    # полки на стене, размытые
    shelf = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shelf)
    for sx in (0.08, 0.62):
        x0 = int(w * sx)
        for k, sy in enumerate((0.22, 0.44)):
            y0 = int(h * sy)
            sd.rectangle([x0, y0, x0 + int(w * 0.28), y0 + 10], fill=(0, 0, 0, 90))
            for j in range(7):
                cx = x0 + 40 + j * int(w * 0.035)
                col = random.choice([(143, 38, 69), (89, 107, 70), (216, 203, 179), (60, 60, 60), (200, 160, 64)])
                sd.rounded_rectangle([cx, y0 - 70, cx + 34, y0], 6, fill=col + (70,))
    shelf = shelf.filter(ImageFilter.GaussianBlur(18))
    im.paste(shelf, (0, 0), shelf)
    # столешница
    for y in range(table_y, h):
        t = (y - table_y) / (h - table_y)
        c = tuple(int(wood[i] * (0.75 + 0.35 * t)) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    for k in range(40):
        y = random.randint(table_y + 6, h)
        d.line([(0, y), (w, y + random.randint(-8, 8))], fill=tuple(int(v * 0.8) for v in wood), width=random.randint(1, 3))
    d.line([(0, table_y), (w, table_y)], fill=tuple(int(v * 1.35) for v in wood), width=4)
    im = im.convert("RGBA")
    if light:
        ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        for i in range(4):
            x = int(w * (0.18 + i * 0.13))
            od.polygon([(x, int(h * 0.05)), (x + 220, int(h * 0.05)), (x + 520, h), (x + 300, h)], fill=light + (55,))
        ov = ov.filter(ImageFilter.GaussianBlur(30))
        im = Image.alpha_composite(im, ov)
    if lamp:
        ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(ov).ellipse([int(w * 0.55), int(h * 0.55), int(w * 0.95), int(h * 1.02)], fill=lamp + (70,))
        im = Image.alpha_composite(im, ov.filter(ImageFilter.GaussianBlur(80)))
    if glow:
        ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(ov).ellipse([int(w * 0.58), int(h * 0.40), int(w * 0.86), int(h * 0.95)], fill=glow + (90,))
        im = Image.alpha_composite(im, ov.filter(ImageFilter.GaussianBlur(120)))
    # виньетка
    vg = Image.new("L", (w, h), 0)
    ImageDraw.Draw(vg).ellipse([-w * 0.2, -h * 0.3, w * 1.2, h * 1.3], fill=255)
    vg = vg.filter(ImageFilter.GaussianBlur(200))
    black = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    im = Image.composite(im, black, vg)
    d = ImageDraw.Draw(im)
    label(d, (w // 2, int(h * 0.06)), "ЗАГЛУШКА " + tag, 40, (255, 255, 255, 60))
    return im.convert("RGB")


W, H = 2560, 1440
save(table_plate(W, H, (34, 27, 23), (20, 16, 14), (58, 40, 28), tag="preview/bg/stage"), "preview/bg/stage", 1600)
save(table_plate(W, H, (120, 104, 86), (86, 72, 58), (128, 92, 62), light=(255, 214, 150), tag="home/morning/bg"), "home/morning/bg", 1600)
save(table_plate(W, H, (96, 92, 86), (70, 66, 60), (110, 82, 58), lamp=(255, 226, 170), tag="home/work/bg"), "home/work/bg", 1600)
save(table_plate(W, H, (16, 13, 12), (10, 8, 8), (34, 24, 18), glow=(255, 150, 70), tag="home/closed/bg"), "home/closed/bg", 1600)


# ---------- сумки ----------
S = 2048
BASE = 1700


def shade(im, top=1.12, bot=0.78):
    """Вертикальный градиент яркости по непрозрачной части, чтобы заглушки не были плоскими."""
    px = im.load()
    for y in range(im.height):
        k = top + (bot - top) * y / im.height
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), a)
    return im


def bag_canvas():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def handle(d, x0, x1, top, width, col):
    d.arc([x0, top, x1, top + (x1 - x0) * 1.1], 180, 360, fill=col, width=width)


def bag01():
    im = bag_canvas()
    d = ImageDraw.Draw(im)
    col = (122, 74, 42, 255)
    d.polygon([(560, 820), (1488, 820), (1600, BASE), (448, BASE)], fill=col)
    d.rounded_rectangle([520, 760, 1528, 860], 30, fill=(150, 130, 100, 255))
    d.rounded_rectangle([960, 790, 1088, 900], 16, fill=(200, 160, 64, 255))
    handle(d, 760, 1010, 520, 46, (96, 58, 32, 255))
    handle(d, 1038, 1288, 520, 46, (96, 58, 32, 255))
    for x in range(480, 1580, 40):
        d.line([(x, BASE - 40), (x + 20, BASE - 40)], fill=(230, 210, 170, 255), width=6)
    label(d, (1024, 1300), "1900-е", 90, (255, 240, 220, 200))
    return shade(im)


def bag02():
    im = bag_canvas()
    d = ImageDraw.Draw(im)
    col = (122, 28, 52, 255)
    d.rounded_rectangle([600, 980, 1448, BASE], 140, fill=col)
    d.polygon([(640, 1000), (1408, 1000), (1330, 900), (718, 900)], fill=col)
    d.rectangle([700, 880, 1348, 920], fill=(200, 160, 64, 255))
    d.ellipse([960, 820, 1010, 870], fill=(220, 180, 80, 255))
    d.ellipse([1038, 820, 1088, 870], fill=(220, 180, 80, 255))
    handle(d, 820, 1228, 560, 40, (110, 24, 46, 255))
    label(d, (1024, 1320), "1950-е", 90, (255, 230, 235, 200))
    return shade(im)


def bag03():
    im = bag_canvas()
    d = ImageDraw.Draw(im)
    col = (176, 92, 48, 255)
    d.rounded_rectangle([470, 900, 1578, BASE], 40, fill=col)
    d.rounded_rectangle([470, 880, 1578, 1380], 90, fill=(150, 76, 38, 255))
    for x in (780, 1268):
        d.rectangle([x - 26, 1240, x + 26, 1480], fill=(120, 60, 30, 255))
        d.rounded_rectangle([x - 46, 1380, x + 46, 1440], 8, outline=(200, 160, 64, 255), width=12)
    d.arc([380, 260, 1668, 1500], 195, 345, fill=(140, 70, 34, 255), width=48)
    label(d, (1024, 1560), "1970-е", 90, (255, 235, 220, 200))
    return shade(im)


def bag04():
    im = bag_canvas()
    d = ImageDraw.Draw(im)
    col = (58, 62, 60, 255)
    d.polygon([(560, 900), (1488, 900), (1548, BASE), (500, BASE)], fill=col)
    d.line([(560, 900), (500, BASE)], fill=(150, 98, 60, 255), width=30)
    d.line([(1488, 900), (1548, BASE)], fill=(150, 98, 60, 255), width=30)
    d.rectangle([560, 890, 1488, 930], fill=(150, 98, 60, 255))
    d.rounded_rectangle([650, 1120, 1398, 1560], 30, fill=(66, 70, 68, 255), outline=(40, 42, 41, 255), width=6)
    d.line([(690, 1170), (1360, 1170)], fill=(200, 160, 64, 255), width=16)
    d.rounded_rectangle([1200, 1150, 1240, 1240], 8, fill=(210, 170, 70, 255))
    d.arc([440, 300, 1608, 1300], 200, 340, fill=(48, 50, 49, 255), width=40)
    d.ellipse([500, 870, 560, 930], outline=(200, 160, 64, 255), width=12)
    d.ellipse([1488, 870, 1548, 930], outline=(200, 160, 64, 255), width=12)
    label(d, (1024, 1380), "сейчас", 90, (235, 235, 230, 200))
    return shade(im)


def bag05(base):
    im = base.copy()
    d = ImageDraw.Draw(im)
    # молния разошлась посередине
    d.polygon([(860, 1158), (1100, 1150), (1060, 1200), (990, 1240), (900, 1196)], fill=(20, 18, 16, 255))
    for x in range(870, 1090, 22):
        d.line([(x, 1160), (x + 6, 1150 + random.randint(-12, 12))], fill=(200, 160, 64, 255), width=8)
    # угол порван
    d.polygon([(1548, BASE), (1380, BASE), (1420, 1630), (1470, 1600), (1500, 1520), (1530, 1480)], fill=(0, 0, 0, 0))
    for k in range(18):
        x = random.randint(1400, 1530)
        y = random.randint(1500, BASE - 10)
        d.line([(x, y), (x + random.randint(-30, 30), y + random.randint(10, 40))], fill=(90, 94, 92, 255), width=4)
    return im


b1, b2, b3, b4 = bag01(), bag02(), bag03(), bag04()
for name, im in (("01-1900s-satchel", b1), ("02-1950s-frame-bag", b2), ("03-1970s-messenger", b3),
                 ("04-modern-crossbody", b4), ("05-modern-crossbody-torn", bag05(b4))):
    save(im, "preview/bags/" + name, 1024)


# ---------- предметы эпох ----------
PROPS = {
    "1900-pocket-watch": ("часы", (200, 160, 64), "circle"),
    "1900-tailor-scissors": ("ножницы", (40, 40, 40), "rect"),
    "1900-wooden-spool": ("катушка", (170, 130, 80), "rect"),
    "1900-brass-key": ("ключ", (200, 160, 64), "rect"),
    "1950-gloves": ("перчатки", (236, 226, 206), "rect"),
    "1950-pearls": ("жемчуг", (240, 236, 228), "circle"),
    "1950-compact": ("пудреница", (210, 175, 90), "circle"),
    "1950-lipstick": ("помада", (150, 30, 50), "rect"),
    "1970-sunglasses": ("очки", (110, 70, 40), "rect"),
    "1970-cassette": ("кассета", (50, 50, 50), "rect"),
    "1970-film-camera": ("камера", (70, 70, 70), "rect"),
    "1970-silk-scarf": ("платок", (190, 110, 50), "circle"),
    "now-earbuds-case": ("наушники", (240, 240, 240), "circle"),
    "now-keys": ("ключи", (160, 160, 160), "rect"),
    "now-notebook": ("блокнот", (200, 190, 170), "rect"),
    "now-sunglasses": ("очки", (40, 40, 40), "rect"),
}
for name, (txt, col, shape) in PROPS.items():
    im = Image.new("RGBA", (1200, 1200), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if shape == "circle":
        d.ellipse([140, 140, 1060, 1060], fill=col + (255,))
    else:
        d.rounded_rectangle([160, 300, 1040, 900], 120, fill=col + (255,))
    lum = sum(col) / 3
    label(d, (600, 600), txt, 110, (20, 20, 20, 220) if lum > 140 else (255, 255, 255, 220))
    save(shade(im), "preview/props/" + name, 600)


# ---------- инструменты ----------
needle = Image.new("RGBA", (2048, 512), (0, 0, 0, 0))
d = ImageDraw.Draw(needle)
d.polygon([(120, 236), (1700, 246), (1940, 256), (1700, 266), (120, 276)], fill=(205, 210, 215, 255))
d.ellipse([150, 240, 330, 272], fill=(0, 0, 0, 0))
d.line([(130, 238), (1900, 254)], fill=(250, 250, 255, 255), width=3)
save(needle, "preview/tools/needle", 1024)


def blade(top):
    im = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    sgn = -1 if top else 1
    d.polygon([(1024, 1024 + sgn * 6), (1800, 1024 + sgn * 4), (1024, 1024 + sgn * 70)], fill=(190, 196, 200, 255))
    d.ellipse([560, 1024 + sgn * 180 - 130, 860, 1024 + sgn * 180 + 130], outline=(30, 30, 30, 255), width=50)
    d.line([(820, 1024 + sgn * 120), (1024, 1024 + sgn * 20)], fill=(30, 30, 30, 255), width=60)
    d.ellipse([1004, 1004, 1044, 1044], fill=(120, 120, 120, 255))
    return im


save(blade(True), "preview/tools/scissors-blade-top", 1024)
save(blade(False), "preview/tools/scissors-blade-bottom", 1024)


def small(name, txt, col):
    im = Image.new("RGBA", (800, 800), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([160, 120, 640, 680], 60, fill=col + (255,))
    label(d, (400, 400), txt, 70, (255, 255, 255, 220))
    save(im, "preview/tools/" + name, 400)


small("thread-spool-red", "нить", (143, 38, 69))
small("thimble", "напёрсток", (200, 160, 64))
small("pin", "булавка", (143, 38, 69))
small("zipper-slider", "бегунок", (200, 160, 64))


# ---------- текстуры ----------
th = Image.new("RGBA", (2048, 64), (0, 0, 0, 0))
d = ImageDraw.Draw(th)
d.rectangle([0, 22, 2048, 42], fill=(143, 38, 69, 255))
for x in range(-40, 2088, 16):
    d.line([(x, 22), (x + 14, 42)], fill=(190, 70, 100, 255), width=4)
save(th, "preview/tex/thread-red-tile")
print("ok")
