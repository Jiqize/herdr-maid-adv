// A 读懂工作：选项识别 → 按钮 → 按键；概括成功替换台词，失败保留模板句；SMART 关掉不读屏
import assert from "node:assert/strict";
import { S } from "./herdr-mock.js";
import { Director } from "./engine.js";
import { parseOptions, tidy } from "./smart.js";

const CLAUDE_MENU = `⏺ Bash(npm test)
╭──────────────────────────────────────────────╮
│ Bash command                                 │
│   npm test                                   │
│ Do you want to proceed?                      │
│ ❯ 1. Yes                                     │
│   2. Yes, and don't ask again for npm commands │
│   3. No, and tell Claude what to do differently (esc) │
╰──────────────────────────────────────────────╯`;
const CODEX_YN = `Running: rm -rf build/\nAllow command? [y/n]`;
const PLAIN_LIST = `我打算这样做：\n1. 先改 engine.js\n2. 再补测试\n要继续吗？`;
const CODEX_MENU = `  Would you like to run the following command?\n  $ cargo test\n› 1. Yes, proceed (y)\n  2. Yes, and don't ask again (a)\n  3. No, and tell Codex what to do differently (esc)`;

// 1 解析
let o = parseOptions(CLAUDE_MENU);
assert.equal(o.kind, "menu"); assert.deepEqual(o.items.map((i) => i.key), ["1", "2", "3"]);
assert.equal(o.items[0].label, "Yes");
assert.ok(Array.from(o.items[1].label).length <= 16, "长选项被截短");
console.log("claude menu:", JSON.stringify(o.items));
o = parseOptions(CODEX_MENU); assert.equal(o.kind, "menu"); assert.equal(o.items.length, 3);
console.log("codex menu:", JSON.stringify(o.items));
o = parseOptions(CODEX_YN); assert.equal(o.kind, "yn"); console.log("codex y/n:", JSON.stringify(o.items));
assert.equal(parseOptions(PLAIN_LIST), null, "没有选中箭头的编号列表不算选项");
assert.equal(parseOptions("all good\n> "), null);
console.log("plain list / no options: null");
assert.equal(tidy("「主人，测试全过了哦」\n"), "主人，测试全过了哦");
assert.equal(tidy(""), null);

// 2 引擎：blocked + Claude 菜单 → 按钮 → 按键
let clock = new Date("2026-11-03T15:00:00").getTime(); Date.now = () => clock;
const tasks = [];
const acx = { notify() {}, spawn(fn) { tasks.push(fn(acx)); } };
const cx = { timer: { after(_ms, fn) { fn(acx); } } };
const flush = async () => { while (tasks.length) await tasks.shift(); };
const ag = (address, status, focused = false) => ({ address, status, focused, pane: "p" + address, space: "s1", space_name: "api", tab: "t1", tab_name: "1", program: { name: "Claude Code" } });

const d = new Director();
S.agents = [ag("a", "working")]; d.update(cx); d.skip();
S.screen["t-a"] = CLAUDE_MENU;
S.claude = "主人，npm test 想跑一下，要允许吗？";
S.agents = [ag("a", "blocked")]; let r = d.update(cx);
console.log("before smart:", r.line.text);
await flush();
r = d.update(cx);
console.log("after smart:", r.line.text, "| choices:", r.line.choices.map((c) => c.label).join(" / "));
assert.equal(r.line.text, S.claude);
assert.equal(r.line.choices[0].act, "key:1");
assert.ok(r.line.options, "line.options 存在 → 对话框不显示回复框");
assert.equal(S.hc.filter((a) => a[0] === "read").length, 1, "只读一次屏");
assert.equal(S.exec.length, 1, "只概括一次");
// 再渲染几次也不会重复调用
d.update(cx); d.update(cx); await flush();
assert.equal(S.exec.length, 1);
const ok = await d.press(r.line, "1");
assert.ok(ok);
assert.deepEqual(S.hc.at(-1), ["keys", "t-a", "1"]);
r = d.update(cx);
console.log("pressed:", JSON.stringify(S.hc.at(-1)), "| reply:", r.line.text);
assert.equal(r.line.kind, "reply");

// 3 概括失败：保留模板句；done 不找选项
clock += 10000;
S.agents = [ag("a", "working")]; d.update(cx);
S.screen["t-a"] = "✓ 42 passed\n> ";
S.claude = null;
clock += 3000; S.agents = [ag("a", "done")]; r = d.update(cx);
const tpl = r.line.text;
await flush(); r = d.update(cx);
console.log("fail keeps template:", r.line.text);
assert.equal(r.line.text, tpl);
assert.equal(r.line.options, null);
assert.equal(r.line.choices[0].act, "go");

// 4 SMART 关掉：不读屏、不调用 claude
d.skip(); const reads = S.hc.length, calls = S.exec.length;
S.shared["adv.smart"] = false;
S.agents = [ag("a", "working")]; d.update(cx);
clock += 3000; S.agents = [ag("a", "blocked")]; d.update(cx); await flush();
assert.equal(S.hc.length, reads); assert.equal(S.exec.length, calls);
console.log("smart off: no read, no claude");
console.log("OK");
