"""Перегоняет PNG от Codex в webp для сайта.

Берёт всё из папки assets-src/ (как в задании codex-atelier-brief.md)
и кладёт в img/ с теми же путями: полный размер и маленькую версию -m
для телефонов. Заглушки с теми же именами заменяются.

Запуск из корня проекта:
    pip install pillow
    python tools/convert.py            (по умолчанию берёт ./assets-src)
    python tools/convert.py D:/codex/assets-src
"""
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "assets-src")
DST = os.path.join(ROOT, "img")

# (условие по пути, длинная сторона полной версии, длинная сторона -m)
RULES = [
    (lambda p: p.startswith("preview/bg/") or p.endswith("/bg") or "/light-" in p, 2560, 1600),
    (lambda p: p.startswith("preview/bags/"), 2048, 1024),
    (lambda p: p.startswith("preview/tex/"), None, None),
    (lambda p: "scissors-blade" in p or "wheel" in p, 1024, 512),
    (lambda p: p.endswith("needle"), 1400, 700),
    (lambda p: p.startswith("preview/props/"), 900, 500),
    (lambda p: True, 1400, 700),
]


def fit(im, side):
    if side is None or max(im.size) <= side:
        return im
    k = side / max(im.size)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    opaque = im.mode == "RGB" or im.getchannel("A").getextrema()[0] == 255
    if opaque:
        im.convert("RGB").save(path, "WEBP", quality=84, method=6)
    else:
        im.save(path, "WEBP", quality=86, alpha_quality=92, method=6)
    return os.path.getsize(path)


def main():
    if not os.path.isdir(SRC):
        sys.exit("нет папки " + SRC)
    total = 0
    for dirpath, _, files in os.walk(SRC):
        for f in sorted(files):
            if not f.lower().endswith(".png"):
                continue
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, SRC).replace("\\", "/")[:-4]
            big, small = next((b, s) for test, b, s in RULES if test(rel))
            im = Image.open(full)
            im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
            a = save(fit(im, big), os.path.join(DST, rel + ".webp"))
            b = save(fit(im, small or big), os.path.join(DST, rel + "-m.webp")) if small else 0
            total += a + b
            print(f"{rel:48s} {a // 1024:5d} КБ   -m {b // 1024:4d} КБ")
    print(f"всего {total // 1024} КБ")


if __name__ == "__main__":
    main()
