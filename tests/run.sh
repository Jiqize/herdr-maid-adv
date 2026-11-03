#!/bin/sh
# 对话引擎流程测试：把 mod 源码复制到临时目录，herdr 换成 mock，再用 node 跑
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d)
for f in engine state lines manifest smart; do sed 's#from "herdr"#from "./herdr-mock.js"#' mods/maid-adv/$f.js > "$T/$f.js"; done
cp tests/herdr-mock.js tests/*.test.mjs "$T/"
for t in "$T"/*.test.mjs; do echo "== $(basename "$t")"; node "$t"; done
rm -rf "$T"
