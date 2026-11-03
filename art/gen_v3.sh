#!/bin/bash
# v3 生图：闭眼 / 张嘴差分（基于普通表情原图编辑）+ 圣诞服装 4 表情 sheet；每批 6 个并行，已有产物跳过
cd "$(dirname "$0")/ai"
export ROOT="$(cd ../.. && pwd)"
job() {
  kind=$1; mid=$2
  case $kind in
    blink|talk)
      dir="$mid-$kind"; out="$PWD/$dir/$mid-$kind.png"; ref="$PWD/$mid/$mid-normal.png"
      if [ $kind = blink ]; then change="her eyes are gently CLOSED (a natural blink, eyelids down, curved closed-eye lines), mouth unchanged"; else change="her mouth is OPEN as if speaking a word (small open mouth showing a bit of the inside), eyes unchanged"; fi
      prompt="Edit the attached image and save the result as a PNG file at this absolute path: $out

Make an EXACT copy of the attached character image (same size, same canvas, same pose, same position, same lineart, same colors, same flat pure green background) with ONLY ONE change: $change. Everything else must stay pixel-identical: do not move, rescale, crop, recolor or redraw anything else. Output exactly ONE image." ;;
    xmas)
      dir="xmas-$mid"; out="$PWD/$dir/xmas-$mid-sheet.png"; ref="$PWD/$mid/$mid-sheet.png"
      prompt="Generate exactly ONE image with your image generation tool, then save it as a PNG file at this absolute path: $out

Redraw the attached visual-novel expression sheet of this SAME original character in a CHRISTMAS maid outfit: a red and white Christmas maid dress with white fluffy trim, a small Santa hat worn together with her lace headdress, a green holly brooch with red berries, red ribbon accents; keep her face, hair, hairstyle, eye color and personal accessories exactly the same. Keep EXACTLY the same layout as the attached sheet: 2:1 canvas, one row of four panels, same half-body framing and size, same four poses and expressions in the same order (1 normal hands folded, 2 happy heart hands eyes closed, 3 worried holding a notepad, 4 pouting arms crossed), flat pure green (#00FF00) background, no green on the character. Polished modern galgame character art, wholesome. No text, no watermark." ;;
  esac
  [ -f "$out" ] && return
  mkdir -p "$dir"
  # 存档的 prompt 去掉本机绝对路径（发给 codex 的仍是完整路径）
  echo "${prompt//$ROOT\//}" > "$dir/prompt.txt"
  echo "$prompt" | codex exec --skip-git-repo-check -s workspace-write -C "$PWD/$dir" -i "$ref" - > "$dir/codex.log" 2>&1
}
export -f job
for mid in ichigo yoru purin yukimi koko soda budou mikan rin; do
  echo "blink $mid"; echo "talk $mid"; echo "xmas $mid"
done | xargs -P 6 -L 1 bash -c 'job $0 $1'
echo "all done" > gen_v3.done
