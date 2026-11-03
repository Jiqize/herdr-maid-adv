// D 作息：休息建议、休息结束、番茄钟、下班提醒、晨间问候、本周回忆（全部用 mock 时钟）
import assert from "node:assert/strict";
import { S } from "./herdr-mock.js";
import { Director } from "./engine.js";
import { Care } from "./care.js";

const MIN = 60000;
let clock = new Date("2026-11-04T09:00:00").getTime(); Date.now = () => clock;  // 周三
const cx = { timer: { after() {} } };
const ag = (address, status, focused = false) => ({ address, status, focused, pane: "p" + address, space: "s1", space_name: "api", tab: "t1", tab_name: "1", program: { name: "Claude Code" } });
const say = (r) => `${r.line.kind}/${r.line.maid}: ${r.line.text}`;

// 0 Care 单元：窗口里有动静才提醒；没动静的窗口悄悄滚过去；离开很久回来不会马上催
let c = new Care(0);
assert.deepEqual(c.tick(91 * MIN, false), [], "整段没有动静不提醒");
c.tick(100 * MIN, true);
assert.deepEqual(c.tick(180 * MIN, false), []);
assert.deepEqual(c.tick(181 * MIN, false), ["rest"]);
c = new Care(0);
assert.deepEqual(c.tick(300 * MIN, true), [], "离开 5 小时回来，第一次动静不催");
assert.deepEqual(c.tick(390 * MIN, false), ["rest"]);
c = new Care(0); c.tick(1, true);
assert.deepEqual(c.tick(90 * MIN, false, 90 * MIN), ["rest", "tomato"], "同时到点都不丢");

// 1 晨间问候：昨天（周二）的日报
S.shared["adv.daily"] = { day: new Date("2026-11-03T12:00:00").toDateString(), done: 7, blocked: 2, waitSum: 0, waitN: 0, longest: { maid: "yoru", ms: 20 * MIN }, by: { yoru: 4, ichigo: 3 }, replies: 0, love: 0 };
const d = new Director();
S.agents = [ag("a", "working", true)];
let r = d.update(cx);
console.log("1 morning:", say(r));
assert.match(r.line.text, /昨天大家一共完成了 7 件/);
assert.match(r.line.text, /让小夜等了最久，20 分钟/);
assert.equal(S.shared["adv.history"].length, 1, "昨天的日报已归档");
d.choose(r.line, "home"); clock += 3000; d.update(cx);
// 同一天再开一次：普通问候
const d2 = new Director(); r = d2.update(cx);
assert.doesNotMatch(r.line.text, /昨天/); console.log("1b second open:", r.line.text);

// 2 连续营业 90 分钟（期间有动静）→ 女仆长建议休息
clock += 30 * MIN; S.agents = [ag("a", "done", true)]; d.update(cx);
clock += 61 * MIN; r = d.update(cx);
console.log("2 rest:", say(r), "|", r.line.choices.map((x) => x.label).join(" / "));
assert.equal(r.line.kind, "rest");
d.choose(r.line, "break"); r = d.update(cx); console.log("  break:", r.line.text);
clock += 5 * MIN; r = d.update(cx);
console.log("  break end:", say(r)); assert.equal(r.line.kind, "breakEnd");
d.choose(r.line, "ok"); clock += 3000; r = d.update(cx); assert.notEqual(r.line.kind, "breakEnd");

// 3 番茄钟：开始 → 顶栏剩余 → 到点由当班女仆（聚焦的那位）通知；可取消
d.tomato(); r = d.update(cx); console.log("3 tomato start:", r.line.text);
assert.equal(S.shared["adv.tomato"], clock + 25 * MIN);
clock += 24 * MIN; r = d.update(cx); assert.notEqual(r.line.kind, "tomato");
clock += 1 * MIN; r = d.update(cx);
console.log("  tomato due:", say(r)); assert.equal(r.line.kind, "tomato"); assert.equal(r.line.maid, "ichigo");
assert.equal(S.shared["adv.tomato"], null);
d.choose(r.line, "again"); assert.equal(S.shared["adv.tomato"], clock + 25 * MIN);
clock += 3000; d.tomato(); assert.equal(S.shared["adv.tomato"], null); r = d.update(cx); console.log("  cancel:", r.line.text);

// 4 日报邀请（18 点）不再被误结算；19 点下班提醒，每天一次
clock = new Date("2026-11-04T18:30:00").getTime(); d.care.reset(clock);
d.update(cx); clock += 1000; r = d.update(cx); console.log("4 report:", say(r)); assert.equal(r.line.kind, "report");
clock += 3000; r = d.update(cx); assert.equal(r.line.kind, "report", "日报邀请还在");
d.choose(r.line, "dismiss");
clock = new Date("2026-11-04T19:05:00").getTime(); d.care.reset(clock); r = d.update(cx);
console.log("  offwork:", say(r)); assert.equal(r.line.kind, "offwork");
d.choose(r.line, "ok"); clock += 3000; d.update(cx); clock += 3000; r = d.update(cx);
assert.notEqual(r.line.kind, "offwork"); assert.ok(!d.queue.some((e) => e.kind === "offwork"), "一天只提醒一次");

// 5 周五：提议看本周回忆，每周一次
clock = new Date("2026-11-06T10:00:00").getTime(); d.care.reset(clock); r = d.update(cx);
const wk = d.queue.find((e) => e.kind === "week"); assert.ok(wk, "周五提议本周回忆");
d.promote(wk.key); r = d.update(cx); console.log("5 week:", say(r));
d.choose(r.line, "week"); console.log("  runs:", JSON.stringify(S.runs.at(-1)));
assert.deepEqual(S.runs.at(-1), ["overlay", "week"]);
clock += 3600000; d.update(cx); assert.ok(!d.queue.some((e) => e.kind === "week"));
console.log("OK");
