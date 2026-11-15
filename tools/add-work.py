"""Добавляет работу на страницу "Было и стало".

Берёт два фото (до и после), поворачивает по EXIF, обрезает по центру до 4:3,
сохраняет в works/img/ как webp (полная 1600x1200 и -m 800x600 для телефонов)
и дописывает работу в начало works/list.json.

Запуск из корня проекта:
    pip install pillow
    python tools/add-work.py до.jpg после.jpg "Замена молнии на рюкзаке"
    python tools/add-work.py до.jpg после.jpg "Ручка у сумки" --date 2026-11-20

Убрать пример (демо-работу), когда появятся настоящие:
    python tools/add-work.py --remove-demo
"""
import datetime
import json
import os
import sys

from PIL import Image, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LIST = os.path.join(ROOT, "works", "list.json")
IMG = os.path.join(ROOT, "works", "img")


def crop43(im):
    w, h = im.size
    if w / h > 4 / 3:
        nw = round(h * 4 / 3)
        return im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    nh = round(w * 3 / 4)
    return im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))


def save(src, base):
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    im = crop43(im)
    im.resize((1600, 1200), Image.LANCZOS).save(base + ".webp", "WEBP", quality=82, method=6)
    im.resize((800, 600), Image.LANCZOS).save(base + "-m.webp", "WEBP", quality=80, method=6)


def read_list():
    if not os.path.exists(LIST):
        return []
    with open(LIST, encoding="utf-8") as f:
        return json.load(f)


def write_list(items):
    with open(LIST, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    args = sys.argv[1:]
    items = read_list()

    if args == ["--remove-demo"]:
        keep = [w for w in items if not w.get("demo")]
        for w in items:
            if w.get("demo"):
                for k in ("before", "after"):
                    for suf in (".webp", "-m.webp"):
                        p = os.path.join(ROOT, w[k] + suf)
                        if os.path.exists(p):
                            os.remove(p)
        write_list(keep)
        print("пример убран, работ осталось:", len(keep))
        return

    date = datetime.date.today().isoformat()
    if "--date" in args:
        i = args.index("--date")
        date = args[i + 1]
        del args[i:i + 2]
    if len(args) != 3:
        sys.exit(__doc__)
    before, after, title = args

    os.makedirs(IMG, exist_ok=True)
    n = 1
    while os.path.exists(os.path.join(IMG, f"{date}-{n}-before.webp")):
        n += 1
    wid = f"{date}-{n}"
    save(before, os.path.join(IMG, wid + "-before"))
    save(after, os.path.join(IMG, wid + "-after"))

    items.insert(0, {
        "id": wid,
        "before": f"works/img/{wid}-before",
        "after": f"works/img/{wid}-after",
        "title": title,
        "date": date
    })
    write_list(items)
    print("добавлено:", wid, "-", title, "| всего работ:", len(items))


if __name__ == "__main__":
    main()
