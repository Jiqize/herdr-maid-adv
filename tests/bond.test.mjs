// C 纪念日 / 生日 / 同屏插话（mock 时钟）
import assert from "node:assert/strict";
import { S } from "./herdr-mock.js";
import { Director } from "./engine.js";
import { businessDay } from "./state.js";

const MIN = 60000;
const cx = { timer: { after() {} } };
const ag = (address, status, focused = false) => ({ address, status, focused, pane: "p" + address, space: "s1", space_name: "api", tab: "t1", tab_name: "1", program: { name: "Claude Code" } });
const reset = () => { for (const k of Object.keys(S.shared)) delete S.shared[k]; };
let clock; Date.now = () => clock;

// 1 营业天数：首次打开记第 1 天，按日历天数累加；第 7 天女仆长说纪念台词，只说一次
clock = new Date("2026-11-01T10:00:00").getTime();
assert.equal(businessDay(), 1);
clock = new Date("2026-11-07T23:59:00").getTime(); assert.equal(businessDay(), 7);
let d = new Director(); S.agents = []; d.update(cx);
let an = d.queue.find((e) => e.kind === "anniv"); assert.ok(an, "第 7 天有纪念台词");
d.promote(an.key); let r = d.update(cx); console.log("1 anniv:", r.line.maid, r.line.text);
assert.match(r.line.text, /第 7 天/);
d = new Director(); d.update(cx); assert.ok(!d.queue.some((e) => e.kind === "anniv"), "同一天再开不重复");
clock = new Date("2026-11-30T09:00:00").getTime(); d = new Director(); d.update(cx);
assert.equal(d.queue.find((e) => e.kind === "anniv")?.n, 30); console.log("  day 30 ok");

// 2 生日：当天开店问候由她来说；回「生日快乐！」+2 好感
reset(); clock = new Date("2026-02-22T09:00:00").getTime();
d = new Director(); S.agents = [ag("a", "working", true)]; r = d.update(cx);
console.log("2 birthday:", r.line.maid, r.line.text, "|", r.line.choices.map((c) => c.label).join());
assert.equal(r.line.maid, "mikan"); assert.equal(r.line.choices[0].act, "bday");
d.choose(r.line, "bday"); r = d.update(cx); console.log("  thanks:", r.line.text);
assert.equal(S.shared["adv.love"].mikan, 2);
clock = new Date("2026-02-23T09:00:00").getTime(); d = new Director(); r = d.update(cx);
assert.equal(r.line.maid, "rin", "第二天恢复女仆长问候");

// 3 同屏插话：两人在排队、没有急事 → 后面那位插一句（不换掉当前说话的人），10 分钟内不再插
reset(); clock = new Date("2026-11-04T10:00:00").getTime();
d = new Director(); S.agents = [ag("a", "working"), ag("b", "working"), ag("c", "working")]; r = d.update(cx); d.skip();
clock += 1000; S.agents = [ag("a", "done"), ag("b", "done"), ag("c", "working")]; r = d.update(cx);
const speaker = r.line.maid;
assert.equal(r.banter, null, "刚开口不插话");
clock += 3500; r = d.update(cx);
console.log("3 banter:", speaker, "说着 →", r.banter?.maid, "插话：", r.banter?.text);
assert.ok(r.banter && r.banter.maid !== speaker); assert.equal(r.line.maid, speaker, "主对话不换人");
assert.deepEqual(S.shared["adv.banter"], r.banter);
clock += 5000; r = d.update(cx); assert.equal(r.banter, null, "4.5 秒后收起"); assert.equal(S.shared["adv.banter"], null);
d.rotate(); clock += 4000; r = d.update(cx); assert.equal(r.banter, null, "10 分钟内不再插话");
// 有急事时不插话
clock += 11 * MIN; S.agents = [ag("a", "done"), ag("b", "done"), ag("c", "blocked")]; d.update(cx); clock += 4000; r = d.update(cx);
assert.equal(r.banter, null, "有人卡住时不插话"); console.log("  blocked → no banter");
console.log("OK");
