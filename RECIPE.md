# Maid Café ADV

Herdr as a visual novel. Agents are original maids; status changes become lines of dialogue that queue up, and only one maid stands on the stage at a time, so a space with many agents never gets crowded.

## What you see
- Root column: `top` (48 px: chapter badge "第 N 话" + space name → chapter picker, ◀ ▶ space.prev/next, tab bookmarks with the maid's head, +, Files, Changes, stage toggle), `body` row (`main` panes radius 10 with a 30 px header mod; hidden `panel` stack; `stage` 360 px), `dialog` (178 px).
- Stage: café illustration (day / night), the speaker's half-body portrait (4 expressions: normal, happy, ask, pout) with breathing, slide-in on speaker change, mood icon (heart / sweat / anger), and a "今日当班" row of every agent's head with a status ring.
- Dialog: name plate in the maid's color with persona and love title + 5 hearts, typewriter text (click to finish), ▼, choices, queue heads (click to promote), LOG / AUTO / SKIP / CONFIG.
- Pane header: maid head + name · program, folder, "正在跟主人说话…" when she's the speaker, "等您吩咐" when blocked.

## How it behaves
- `engine.js` Director: events greet (head maid Rin), intro (new agent), done, blocked, angry (blocked ≥ 5 min). Priority angry = blocked > done > intro > greet, then time. With no events: the focused working agent's maid reports progress, else Rin summarizes.
- Choices: go (pane.focus), later (+5 min), wait (+3 min), thanks / hello (+1 love), home. Focusing a pane resolves its event and she replies.
- Love per maid in `shared("adv.love")`: blocked answered < 1 min +2, < 5 min +1, ≥ 15 min −1; done looked at < 3 min +1.
- Shared: `adv.speaker`, `adv.maids`, `adv.love`, `adv.log`, `adv.auto`. Only one-shot `cx.timer.after` and native animations.

## v3
- Reading the work (`smart.js`): on done / blocked enqueue, once per event, `hc read <t> --lines 80 --json` → last 60 lines. Blocked: last 25 lines → numbered menu (consecutive from 1, at least one line with a ❯ / › cursor) or `[y/n]` → choice buttons `key:<k>` that run `hc keys <t> <k>`, and the reply input is hidden. Summary: `exec("claude", ["-p", "--model", "haiku", "--no-session-persistence", "--setting-sources", "project", "--disallowedTools", …])` with the maid's persona, ≤ 60 chars; until it returns (or if it fails) the template line stays. `shared("adv.smart") === false` turns all of it off.
- Portraits (`stage.js`): blink / talk patches from `art/build.py` (edit diff vs the normal sheet, ±3 px shift search, bbox of changed pixels in the top half, 6 px feathered alpha) sit over the normal portrait, toggled by opacity. Mouth flips every 120 ms while `adv.speaker.talking`; blink 140 ms every 3–6 s. `state.js OUTFITS` date table: `maidOf()` returns the outfit set (portraits + heads, no patches) on those days.
- System events (never settled by agents): report, rest, breakEnd, tomato, offwork, week, anniv. `care.js`: 90-minute windows, a rest hint only if the window saw a focus or status change; 5-minute break; tomato end in `shared("adv.tomato")` (top bar pill, minute refresh). Daily stats roll into `adv.history` (14 days) for the morning recap and the week overlay.
- Stories (`story.js`): per maid 2 acts + choice + good / bad ending (good shows the CG); unlock at love level 3, `shared("adv.story")`, replay from the gallery. Birthdays replace the opening greeting; anniversaries on business day 7 / 30 / 100 (`adv.firstDay`). Banter: when no one is blocked and another maid waits, the last one says one line on the stage's lower left (`adv.banter`, 4.5 s, at most every 10 min).

## Watch out
- `line_height` takes `"26px"`; a bare number is not pixels.
- Element values are single-use.
- Only the `dialog` copy owns the Director and listens to `nextCommand()`.
- Async work started from render (screen read, summary) goes through `cx.timer.after(…, (acx) => acx.spawn(…))`, so it holds an AsyncContext and can `notify()` when it finishes.
- `toLocaleDateString("zh-CN", …)` ignores its options here; format dates by hand.
- `claude -p --bare` doesn't read the keychain login; use `--setting-sources project` to skip local hooks instead.
