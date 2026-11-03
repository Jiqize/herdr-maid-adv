#!/bin/sh
# 安装 maid-adv 布局到 Herdr GUI 配置目录（只覆盖本布局自己的文件）
set -e
cd "$(dirname "$0")"
H="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
mkdir -p "$H/layouts" "$H/themes" "$H/mods/maid-adv"
cp layouts/maid-adv.json layouts/maid-adv.svg "$H/layouts/"
cp themes/maid-adv.json themes/maid-adv-night.json "$H/themes/"
rsync -a --delete --exclude jsconfig.json --exclude '*.d.ts' mods/maid-adv/ "$H/mods/maid-adv/"

# 合并布局附带的快捷键；已有同名键且不同 → 询问，默认不覆盖
python3 -I - "$H/keys.json" mods/maid-adv/keys.json <<'EOF'
import json, os, shutil, sys, time
dst, src = sys.argv[1], sys.argv[2]
mine = json.load(open(src))
cur = json.load(open(dst)) if os.path.exists(dst) else {}
changed = False
for section, binds in mine.items():
    sec = cur.setdefault(section, {})
    for key, action in binds.items():
        if sec.get(key) == action:
            continue
        if key in sec:
            print(f"[{section}] {key} 已绑定为 {sec[key]}，改成 {action}？[y/N] ", end="", flush=True)
            try:
                reply = open("/dev/tty").readline().strip().lower()
            except OSError:
                reply = ""
            if reply != "y":
                print("保留原绑定")
                continue
        sec[key] = action
        changed = True
if changed:
    if os.path.exists(dst):
        shutil.copy(dst, f"{dst}.bak-{time.strftime('%Y%m%d%H%M%S')}")
    json.dump(cur, open(dst, "w"), indent=2, ensure_ascii=False)
    print("keys.json 已合并 maid-adv 快捷键")
EOF
echo "installed to $H"
