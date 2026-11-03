# 一键生成 mods/maid-adv/assets/ 与 manifest.js
# 用法：python3 -I art/build.py（需要 Pillow 和 numpy）
#   立绘：绿幕动作表 → 抠图去绿边 → 切成 4 张差分 → 按 4 张的并集对齐裁切（换表情不跳位）
#   头像：从「普通」差分里按皮肤重心裁脸；背景：转 JPEG；表情符号：程序绘制
import json, os, shutil, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ART = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(ART)
OUT = os.path.join(ROOT, "mods", "maid-adv", "assets")
MOODS = ("normal", "happy", "ask", "pout")
TACHIE_H = 1000

CAST = [
    ("ichigo", "莓莓", "#ef6f8e"), ("yoru", "小夜", "#8a7ad6"), ("purin", "布丁", "#e0a62e"),
    ("yukimi", "雪见", "#6fa8d6"), ("koko", "可可", "#a7755a"), ("soda", "汽水", "#3fa0e0"),
    ("budou", "葡萄", "#a04a8a"), ("mikan", "橘子", "#f2883a"), ("rin", "铃", "#9a3048"),
]

def key_green(im):
    a = np.asarray(im.convert("RGB")).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = g - np.maximum(r, b)
    alpha = np.clip(1 - (green - 30) / 70, 0, 1)
    # 去绿边：半透明和边缘像素把绿色压到红蓝的最大值
    spill = green > 0
    g2 = np.where(spill, np.minimum(g, np.maximum(r, b) + 8), g)
    out = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    # 抠图后收一圈 alpha，去掉毛边
    al = img.getchannel("A").filter(ImageFilter.MinFilter(3))
    img.putalpha(al)
    return img

def bbox(img):
    a = np.asarray(img.getchannel("A")) > 20
    ys, xs = np.where(a)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def face_center(img):
    a = np.asarray(img).astype(int)
    x0, y0, x1, y1 = bbox(img)
    top = y0 + int((y1 - y0) * 0.4)
    sub = a[y0:top, x0:x1]
    r, g, b, al = sub[..., 0], sub[..., 1], sub[..., 2], sub[..., 3]
    skin = (al > 200) & (r > 225) & (g > 180) & (g < 232) & (b > 160) & (b < 222) & (r - b > 18)
    ys, xs = np.where(skin)
    if len(xs) < 80:
        return (x0 + x1) / 2, y0 + (y1 - y0) * 0.16
    return x0 + float(np.median(xs)), y0 + float(np.median(ys))

def fx_images():
    out = {}
    # 爱心
    im = Image.new("RGBA", (96, 88)); d = ImageDraw.Draw(im)
    d.ellipse([4, 4, 50, 50], fill="#ff5f8f"); d.ellipse([46, 4, 92, 50], fill="#ff5f8f")
    d.polygon([(6, 34), (90, 34), (48, 84)], fill="#ff5f8f")
    d.ellipse([16, 14, 30, 28], fill="#ffd0de")
    out["heart"] = im
    # 汗滴
    im = Image.new("RGBA", (56, 80)); d = ImageDraw.Draw(im)
    d.polygon([(28, 2), (6, 46), (50, 46)], fill="#7cc8ff"); d.ellipse([6, 26, 50, 74], fill="#7cc8ff")
    d.ellipse([16, 40, 26, 54], fill="#e6f6ff")
    out["sweat"] = im
    # 怒气符号
    im = Image.new("RGBA", (80, 80)); d = ImageDraw.Draw(im)
    for ang in (0, 90, 180, 270):
        g = Image.new("RGBA", (80, 80)); gd = ImageDraw.Draw(g)
        gd.arc([10, 10, 46, 46], 180, 270, fill="#ff4a5a", width=9)
        im.alpha_composite(g.rotate(ang, center=(40, 40)))
    out["anger"] = im
    # 闪光
    im = Image.new("RGBA", (64, 64)); d = ImageDraw.Draw(im)
    d.polygon([(32, 0), (38, 26), (64, 32), (38, 38), (32, 64), (26, 38), (0, 32), (26, 26)], fill="#fff3a8")
    out["sparkle"] = im
    return out

def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    maids = []
    for mid, name, color in CAST:
        sheet = Image.open(os.path.join(ART, "ai", mid, f"{mid}-sheet.png"))
        pw = sheet.width / 4
        panels = [key_green(sheet.crop((round(i * pw), 0, round((i + 1) * pw), sheet.height))) for i in range(4)]
        boxes = [bbox(p) for p in panels]
        u = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        cropped = [p.crop(u) for p in panels]
        k = TACHIE_H / cropped[0].height
        size = (round(cropped[0].width * k), TACHIE_H)
        entry = {"id": mid, "name": name, "color": color, "narrator": mid == "rin", "tachie": {}, "size": list(size)}
        os.makedirs(os.path.join(OUT, "maids", mid), exist_ok=True)
        for mood, p in zip(MOODS, cropped):
            p.resize(size, Image.LANCZOS).save(os.path.join(OUT, "maids", mid, f"{mood}.png"), optimize=True)
            entry["tachie"][mood] = f"maids/{mid}/{mood}.png"
        # 头像：普通差分的脸，正方形，边长约为身高的 26%
        normal = cropped[0]
        cx, cy = face_center(normal)
        side = normal.height * 0.26
        face = normal.crop((round(cx - side / 2), round(cy - side * 0.55), round(cx + side / 2), round(cy + side * 0.45)))
        for mood, p in zip(MOODS, cropped):
            p.crop((round(cx - side / 2), round(cy - side * 0.55), round(cx + side / 2), round(cy + side * 0.45))) \
             .resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, "maids", mid, f"head-{mood}.png"), optimize=True)
        entry["head"] = {m: f"maids/{mid}/head-{m}.png" for m in MOODS}
        # 脸在立绘里的相对位置（放表情符号用）
        entry["face"] = [round(cx / normal.width, 3), round(cy / normal.height, 3)]
        maids.append(entry)
        print(mid, size)
    for b in ("bg-day", "bg-night"):
        Image.open(os.path.join(ART, "ai", b, f"{b}.png")).convert("RGB").resize((768, 1152), Image.LANCZOS) \
            .save(os.path.join(OUT, f"{b}.jpg"), quality=86)
    fx = fx_images()
    os.makedirs(os.path.join(OUT, "fx"), exist_ok=True)
    for n, im in fx.items():
        im.save(os.path.join(OUT, "fx", f"{n}.png"))
    manifest = {
        "maids": maids,
        "bg": {"day": "bg-day.jpg", "night": "bg-night.jpg", "size": [768, 1152]},
        "fx": {n: f"fx/{n}.png" for n in fx},
        "fxSize": {n: [im.width // 2, im.height // 2] for n, im in fx.items()},
    }
    with open(os.path.join(ROOT, "mods", "maid-adv", "manifest.js"), "w") as f:
        f.write("// 由 art/build.py 生成，勿手改\nexport default " + json.dumps(manifest, ensure_ascii=False) + ";\n")
    # 检查图
    os.makedirs(os.path.join(ART, "samples"), exist_ok=True)
    c = Image.new("RGBA", (9 * 4 * 90, 2 * 180 + 10), (60, 40, 60, 255))
    for i, m in enumerate(maids):
        for j, mood in enumerate(MOODS):
            t = Image.open(os.path.join(OUT, m["tachie"][mood])); t.thumbnail((90, 180))
            c.alpha_composite(t, ((i * 4 + j) * 90, 0))
            h = Image.open(os.path.join(OUT, m["head"][mood])).resize((80, 80))
            c.alpha_composite(h, ((i * 4 + j) * 90 + 5, 190))
    c.save(os.path.join(ART, "samples", "check.png"))

if __name__ == "__main__":
    main()
