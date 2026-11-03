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

## Watch out
- `line_height` takes `"26px"`; a bare number is not pixels.
- Element values are single-use.
- Only the `dialog` copy owns the Director and listens to `nextCommand()`.
