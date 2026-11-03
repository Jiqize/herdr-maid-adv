# 一键生成 mods/maid-adv/assets/ 与 manifest.js
# 用法：python3 -I art/build.py（需要 Pillow 和 numpy）
#   立绘：绿幕动作表 → 抠图去绿边 → 切成 4 张差分 → 按 4 张的并集对齐裁切（换表情不跳位）
#   头像：从「普通」差分里按皮肤重心裁脸；背景：转 JPEG；表情符号：程序绘制
#   v3：闭眼 / 张嘴差分 → 和原图对比找出变化区域，只切这一小块（边缘羽化）叠在立绘上；季节服装 sheet 按同样流程切图
import json, os, shutil, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ART = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(ART)
OUT = os.path.join(ROOT, "mods", "maid-adv", "assets")
MOODS = ("normal", "happy", "ask", "pout")
TACHIE_H = 1000
PATCHES = ("blink", "talk")
# 季节服装：名字 → 动作表路径模板（日期在 mod 里的 OUTFITS 表登记）
OUTFITS = {"xmas": "xmas-{mid}/xmas-{mid}-sheet.png"}

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

def cut_sheet(path):
    """动作表 → 4 张抠好的差分，按并集裁切；返回 (panels, union, scale, size)"""
    sheet = Image.open(path)
    pw = sheet.width / 4
    panels = [key_green(sheet.crop((round(i * pw), 0, round((i + 1) * pw), sheet.height))) for i in range(4)]
    boxes = [bbox(p) for p in panels]
    u = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    cropped = [p.crop(u) for p in panels]
    k = TACHIE_H / cropped[0].height
    return cropped, u, k, (round(cropped[0].width * k), TACHIE_H)

def save_set(cropped, size, folder, prefix, q=90):
    """存 4 张立绘 + 4 张头像，返回 manifest 片段"""
    os.makedirs(os.path.join(OUT, folder), exist_ok=True)
    tachie, head = {}, {}
    normal = cropped[0]
    cx, cy = face_center(normal)
    side = normal.height * 0.26
    box = (round(cx - side / 2), round(cy - side * 0.55), round(cx + side / 2), round(cy + side * 0.45))
    for mood, p in zip(MOODS, cropped):
        p.resize(size, Image.LANCZOS).save(os.path.join(OUT, folder, f"{prefix}{mood}.webp"), quality=q, method=6)
        tachie[mood] = f"{folder}/{prefix}{mood}.webp"
        p.crop(box).resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, folder, f"{prefix}head-{mood}.webp"), quality=92, method=6)
        head[mood] = f"{folder}/{prefix}head-{mood}.webp"
    return {"tachie": tachie, "head": head, "size": list(size), "face": [round(cx / normal.width, 3), round(cy / normal.height, 3)]}

def find_shift(base, img, r=3):
    """在 ±r 像素里找让两张图最接近的平移（生图偶尔会挪一点）"""
    a = np.asarray(base.convert("RGB")).astype(np.int16)
    b = np.asarray(img.convert("RGB")).astype(np.int16)
    best = (1e9, 0, 0)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            v = (np.abs(np.roll(np.roll(b, dy, 0), dx, 1) - a).max(2) > 25).mean()
            if v < best[0]:
                best = (v, dx, dy)
    return best[1], best[2]

def make_patch(mid, kind, u, size):
    """闭眼 / 张嘴差分：对齐 → 换算到立绘尺寸 → 找变化区域 → 切小块并羽化边缘"""
    src = os.path.join(ART, "ai", f"{mid}-{kind}", f"{mid}-{kind}.png")
    if not os.path.exists(src):
        return None
    base = Image.open(os.path.join(ART, "ai", mid, f"{mid}-normal.png"))
    img = Image.open(src).convert("RGB").resize(base.size, Image.LANCZOS)
    dx, dy = find_shift(base, img)
    if dx or dy:
        img = Image.fromarray(np.roll(np.roll(np.asarray(img), dy, 0), dx, 1))
    # 和立绘完全同一套变换：抠图 → 并集裁切 → 缩放
    a = key_green(base).crop(u).resize(size, Image.LANCZOS)
    b = key_green(img).crop(u).resize(size, Image.LANCZOS)
    d = np.abs(np.asarray(a).astype(np.int16) - np.asarray(b).astype(np.int16))[..., :3].max(2)
    m = Image.fromarray(((d > 40) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
    ys, xs = np.where(np.asarray(m)[: size[1] // 2] > 0)
    if len(xs) < 10:
        return None
    pad = 10
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    x1, y1 = min(size[0], xs.max() + pad + 1), min(size[1] // 2, ys.max() + pad + 1)
    piece = b.crop((x0, y0, x1, y1))
    # 羽化：离边 6px 内 alpha 线性变淡，和底图无缝衔接
    w, h = piece.size
    f = 6
    ramp = np.minimum.outer(np.minimum(np.arange(h), np.arange(h)[::-1]), np.minimum(np.arange(w), np.arange(w)[::-1]))
    fe = np.clip((ramp + 1) / f, 0, 1)
    al = (np.asarray(piece.getchannel("A")).astype(float) * fe).astype(np.uint8)
    piece.putalpha(Image.fromarray(al))
    name = f"maids/{mid}/{kind}.webp"
    piece.save(os.path.join(OUT, name), lossless=True, method=6)
    return {"x": int(x0), "y": int(y0), "w": int(w), "h": int(h), "img": name, "shift": [dx, dy]}

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
        cropped, u, _k, size = cut_sheet(os.path.join(ART, "ai", mid, f"{mid}-sheet.png"))
        # 头像：普通差分的脸，正方形，边长约为身高的 26%；face 是脸在立绘里的相对位置（放表情符号用）
        entry = {"id": mid, "name": name, "color": color, "narrator": mid == "rin", **save_set(cropped, size, f"maids/{mid}", "")}
        # 闭眼 / 张嘴小块（只用于「普通」表情）
        entry["patch"] = {}
        for kind in PATCHES:
            pt = make_patch(mid, kind, u, size)
            if pt:
                entry["patch"][kind] = pt
        # 季节服装
        entry["outfits"] = {}
        for oid, tpl in OUTFITS.items():
            path = os.path.join(ART, "ai", tpl.format(mid=mid))
            if os.path.exists(path):
                oc, _, _, osize = cut_sheet(path)
                entry["outfits"][oid] = save_set(oc, osize, f"maids/{mid}", f"{oid}-", q=80)  # 一年只穿几天，压狠一点
        maids.append(entry)
        print(mid, size, {k: (v["x"], v["y"], v["w"], v["h"], v["shift"]) for k, v in entry["patch"].items()}, list(entry["outfits"]))
    for b in ("bg-day", "bg-night"):
        Image.open(os.path.join(ART, "ai", b, f"{b}.png")).convert("RGB").resize((768, 1152), Image.LANCZOS) \
            .save(os.path.join(OUT, f"{b}.jpg"), quality=86)
    # CG：大图 960×540（2 倍 1920 宽太大，取 1536 源图原样缩到 1440）、缩略图、未解锁剪影
    cg = {}
    os.makedirs(os.path.join(OUT, "cg"), exist_ok=True)
    for mid, _, _ in CAST:
        src = os.path.join(ART, "ai", f"cg-{mid}", f"cg-{mid}.png")
        if not os.path.exists(src):
            continue
        im = Image.open(src).convert("RGB")
        im = im.resize((1440, round(1440 * im.height / im.width)), Image.LANCZOS)
        im = im.crop((0, (im.height - 810) // 2, 1440, (im.height - 810) // 2 + 810)) if im.height > 810 else im.resize((1440, 810))
        im.save(os.path.join(OUT, "cg", f"{mid}.jpg"), quality=88)
        th = im.resize((428, 240), Image.LANCZOS)
        th.save(os.path.join(OUT, "cg", f"{mid}-thumb.jpg"), quality=86)
        lk = th.filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.45))
        lk.save(os.path.join(OUT, "cg", f"{mid}-locked.jpg"), quality=80)
        cg[mid] = {"full": f"cg/{mid}.jpg", "thumb": f"cg/{mid}-thumb.jpg", "locked": f"cg/{mid}-locked.jpg"}
    kv = os.path.join(ART, "ai", "keyvisual", "keyvisual.png")
    if os.path.exists(kv):
        im = Image.open(kv).convert("RGB")
        im = im.resize((1920, round(1920 * im.height / im.width)), Image.LANCZOS)
        top = max(0, (im.height - 1080) // 2)
        im.crop((0, top, 1920, top + 1080)).save(os.path.join(OUT, "keyvisual.jpg"), quality=86)
    fx = fx_images()
    os.makedirs(os.path.join(OUT, "fx"), exist_ok=True)
    for n, im in fx.items():
        im.save(os.path.join(OUT, "fx", f"{n}.png"))
    manifest = {
        "maids": maids,
        "bg": {"day": "bg-day.jpg", "night": "bg-night.jpg", "size": [768, 1152]},
        "fx": {n: f"fx/{n}.png" for n in fx},
        "cg": cg,
        "keyvisual": "keyvisual.jpg",
        "fxSize": {n: [im.width // 2, im.height // 2] for n, im in fx.items()},
    }
    with open(os.path.join(ROOT, "mods", "maid-adv", "manifest.js"), "w") as f:
        f.write("// 由 art/build.py 生成，勿手改\nexport default " + json.dumps(manifest, ensure_ascii=False) + ";\n")
    # 检查图
    os.makedirs(os.path.join(ART, "samples"), exist_ok=True)
    c = Image.new("RGBA", (9 * 4 * 90, 2 * 180 + 10), (60, 40, 60, 255))
    for i, m in enumerate(maids):
        for j, mood in enumerate(MOODS):
            t = Image.open(os.path.join(OUT, m["tachie"][mood])).convert("RGBA"); t.thumbnail((90, 180))
            c.alpha_composite(t, ((i * 4 + j) * 90, 0))
            h = Image.open(os.path.join(OUT, m["head"][mood])).convert("RGBA").resize((80, 80))
            c.alpha_composite(h, ((i * 4 + j) * 90 + 5, 190))
    c.save(os.path.join(ART, "samples", "check.png"))
    # 差分检查图：每位一行 = 普通脸 / 叠闭眼 / 叠张嘴 / 圣诞普通 / 圣诞 4 表情
    rows = []
    for m in maids:
        base = Image.open(os.path.join(OUT, m["tachie"]["normal"])).convert("RGBA")
        W = base.width
        box = (int(W * 0.15), 60, int(W * 0.9), 60 + int(W * 0.6))
        tiles = [base]
        for kind in PATCHES:
            pt = m["patch"].get(kind)
            t = base.copy()
            if pt:
                t.alpha_composite(Image.open(os.path.join(OUT, pt["img"])).convert("RGBA"), (pt["x"], pt["y"]))
            tiles.append(t)
        tiles = [t.crop(box).resize((220, round(220 * (box[3] - box[1]) / (box[2] - box[0])))) for t in tiles]
        xm = m["outfits"].get("xmas")
        if xm:
            for mood in MOODS:
                t = Image.open(os.path.join(OUT, xm["tachie"][mood])).convert("RGBA"); t.thumbnail((220, tiles[0].height))
                tiles.append(t)
        rows.append(tiles)
    th = rows[0][0].height
    c = Image.new("RGBA", (220 * 7 + 60, th * len(rows)), (60, 40, 60, 255))
    for i, tiles in enumerate(rows):
        x = 0
        for j, t in enumerate(tiles):
            c.alpha_composite(t, (x, i * th)); x += 220 + (60 if j == 2 else 0) if j < 3 else t.width
    c.save(os.path.join(ART, "samples", "patch-check.png"))

if __name__ == "__main__":
    main()
