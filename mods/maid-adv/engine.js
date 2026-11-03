// 对话导演：把 Agent 的状态变化变成排队的台词，同一时间只让一位女仆说话
//   事件：greet 开店问候（女仆长）/ intro 新 Agent 自我介绍 / done 做好了 / blocked 请问 / angry 等太久
//   优先级：angry = blocked > done > intro > greet；同级按发生时间
//   没有事件时说「现状」：当前窗格的女仆在忙就说她自己，否则女仆长汇报
//   所有时间变化用一次性 cx.timer.after 唤醒
import { agents, spaces, panes, run, hc, shared, setShared, openOverlay } from "herdr";
import { PERSONA, RIN, pick, fill } from "./lines.js";
import { assign, maidOf, rin, addLove, where, HOT, record } from "./state.js";

const MIN = 60000;
const ANGRY_AFTER = 5 * MIN;
const REPLY_MS = 2600;
const RANK = { angry: 0, blocked: 0, done: 1, intro: 2, report: 3, greet: 3 };
const REPORT_HOUR = 18;
const MOOD = { report: "happy", greet: "normal", intro: "happy", done: "happy", blocked: "ask", angry: "pout" };
const CHOICES = {
  greet: [["我回来了", "home"]],
  report: [["看看日报", "report"], ["明天再说", "dismiss"]],
  intro: [["请多关照", "hello"]],
  done: [["马上去看", "go"], ["待会儿", "later"], ["辛苦了", "thanks"]],
  blocked: [["这就来", "go"], ["再等一下", "wait"]],
  angry: [["对不起，这就来", "go"], ["再等一下", "wait"]],
};

export class Director {
  constructor() {
    this.init = false;
    this.last = new Map();
    this.queue = [];
    this.curKey = null;
    this.reply = null;
    this.wakeAt = Infinity;
    this.seq = 0;
  }

  wake(cx, at, now) {
    if (at >= this.wakeAt || at === Infinity) return;
    this.wakeAt = at;
    cx.timer.after(Math.max(16, at - now + 30), (cx) => { this.wakeAt = Infinity; cx.notify(); });
  }

  push(ev) {
    if (ev.kind === "done" || ev.kind === "blocked") {
      record((d) => { d[ev.kind] += 1; if (ev.kind === "done") d.by[ev.maid] = (d.by[ev.maid] ?? 0) + 1; });
    }
    // 同一个 Agent 只留最新的一件事
    this.queue = this.queue.filter((e) => !(e.address === ev.address && e.kind !== "greet"));
    this.queue.push({ ...ev, key: `${ev.kind}:${ev.address}:${++this.seq}` });
  }

  say(maid, text, mood, now) {
    this.reply = { maid, text, mood, until: now + REPLY_MS, id: `r${++this.seq}` };
  }

  // 主人对事件的回应 → 好感度；返回升级称号
  love(ev, now) {
    const wait = now - ev.at;
    let d = 0;
    if (ev.kind === "blocked" || ev.kind === "angry") d = wait < MIN ? 2 : wait < 5 * MIN ? 1 : wait >= 15 * MIN ? -1 : 0;
    if (ev.kind === "done") d = wait < 3 * MIN ? 1 : 0;
    if (ev.kind !== "intro") {
      record((s) => {
        s.waitSum += wait; s.waitN += 1;
        if (!s.longest || wait > s.longest.ms) s.longest = { maid: ev.maid, ms: wait };
        if (d > 0) s.love += d;
      });
    }
    return addLove(ev.maid, d);
  }

  // 每次渲染调用：更新队列，返回 { line, queue, mids }
  update(cx) {
    const now = Date.now();
    const list = agents();
    const mids = assign(list);
    const live = new Map(list.map((a) => [a.address, a]));

    if (!this.init) {
      this.queue.push({ kind: "greet", address: "rin", maid: rin().id, at: now, key: "greet" });
      // 启动时已经做好 / 在等的，直接排进队列
      for (const a of list) if (HOT(a.status) && !a.focused) this.push({ kind: a.status, address: a.address, maid: mids.get(a.address), at: now });
    } else {
      for (const a of list) {
        const prev = this.last.get(a.address);
        const mid = mids.get(a.address);
        if (prev === undefined) {
          if (HOT(a.status) && !a.focused) this.push({ kind: a.status, address: a.address, maid: mid, at: now });
          else this.push({ kind: "intro", address: a.address, maid: mid, at: now });
        } else if (prev !== a.status && HOT(a.status) && !a.focused) {
          this.push({ kind: a.status, address: a.address, maid: mid, at: now });
        }
      }
    }

    // 结算：Agent 消失、状态变了、主人已经切过去
    let levelUp = null;
    this.queue = this.queue.filter((ev) => {
      if (ev.kind === "greet") return true;
      const a = live.get(ev.address);
      if (!a) return false;
      if (ev.kind === "intro") return true;
      const base = ev.kind === "angry" ? "blocked" : ev.kind;
      if (a.status !== base || a.focused) {
        const up = this.love(ev, now);
        if (a.focused) {
          const p = PERSONA[ev.maid];
          this.say(ev.maid, up ? `${pick(p?.came, ev.key)}（好感度提升：${up}）` : pick(p?.came, ev.key), "happy", now);
        }
        levelUp = levelUp ?? up;
        return false;
      }
      return true;
    });

    // 等太久：blocked → angry（换生气表情再催一次）
    for (const ev of this.queue) {
      if (ev.kind !== "blocked") continue;
      if (now - ev.at >= ANGRY_AFTER) { ev.kind = "angry"; ev.key = `angry:${ev.address}:${++this.seq}`; }
      else this.wake(cx, ev.at + ANGRY_AFTER, now);
    }
    for (const ev of this.queue) if (ev.snooze > now) this.wake(cx, ev.snooze, now);

    this.last = new Map(list.map((a) => [a.address, a.status]));
    this.init = true;

    // 选出现在说话的人
    let line = null;
    if (this.reply && this.reply.until > now) {
      const r = this.reply;
      line = { id: r.id, maid: r.maid, mood: r.mood, text: r.text, choices: [], address: null, kind: "reply" };
      this.wake(cx, r.until, now);
    } else {
      this.reply = null;
      const ready = this.queue.filter((e) => !(e.snooze > now));
      let ev = ready.find((e) => e.key === this.curKey);
      const best = [...ready].sort((x, y) => RANK[x.kind] - RANK[y.kind] || x.at - y.at)[0];
      // 问候 / 介绍 / 日报这类不急的台词，会被更急的事打断
      if (!ev || (RANK[ev.kind] >= 2 && RANK[best.kind] < RANK[ev.kind])) ev = best;
      if (ev) {
        this.curKey = ev.key;
        line = this.lineFor(ev, live.get(ev.address), now);
      } else if (new Date(now).getHours() >= REPORT_HOUR && shared("adv.reportDay") !== new Date(now).toDateString()) {
        setShared("adv.reportDay", new Date(now).toDateString());
        this.queue.push({ kind: "report", address: "rin", maid: rin().id, at: now, key: `report:${now}` });
        this.curKey = null;
        line = this.ambient(list, mids, now);
      } else {
        this.curKey = null;
        line = this.ambient(list, mids, now);
      }
    }
    const waiting = this.queue.filter((e) => e.key !== this.curKey);
    return { line, queue: waiting, mids, levelUp };
  }

  lineFor(ev, a, now) {
    const choices = CHOICES[ev.kind].map(([label, act]) => ({ label, act }));
    if (ev.kind === "report") {
      return { id: ev.key, maid: ev.maid, mood: "happy", text: "主人，今天的营业日报已经整理好了。要过目吗？", choices, address: null, kind: ev.kind };
    }
    if (ev.kind === "greet") {
      return { id: ev.key, maid: ev.maid, mood: "normal", text: pick(RIN.greet, new Date(now).toDateString()), choices, address: null, kind: ev.kind };
    }
    const p = PERSONA[ev.maid] ?? PERSONA.ichigo;
    const vars = { where: a ? where(a) : "", prog: a?.program?.name ?? a?.app ?? "Agent", min: Math.max(1, Math.floor((now - ev.at) / MIN)) };
    return { id: ev.key, maid: ev.maid, mood: MOOD[ev.kind], text: fill(pick(p[ev.kind], ev.key), vars), choices, address: ev.address, pane: a?.pane, kind: ev.kind };
  }

  // 没有事件时的「现状」
  ambient(list, mids, now) {
    const f = list.find((a) => a.focused);
    if (f && f.status === "working") {
      const mid = mids.get(f.address);
      const p = PERSONA[mid] ?? PERSONA.ichigo;
      const tab = spaces().flatMap((s) => s.tabs).find((t) => t.id === f.tab);
      const since = tab?.working_since ?? now;
      const text = fill(pick(p.busy, f.address), { where: where(f), min: Math.max(1, Math.floor((now - since) / MIN)) });
      return { id: `amb:${text}`, maid: mid, mood: "normal", text, choices: [], address: f.address, pane: f.pane, kind: "ambient" };
    }
    const st = { total: list.length, working: 0, blocked: 0, done: 0 };
    for (const a of list) if (st[a.status] != null) st[a.status] += 1;
    const text = RIN.report(st);
    return { id: `amb:${text}`, maid: rin().id, mood: "normal", text, choices: [], address: null, kind: "ambient" };
  }

  // 主人点了一个选项
  choose(line, act) {
    const now = Date.now();
    const ev = this.queue.find((e) => e.key === line.id);
    const p = PERSONA[line.maid];
    if (act === "go") {
      if (line.pane) run("pane.focus", { pane: line.pane });
      return;
    }
    if (!ev) return;
    if (act === "later" || act === "wait") {
      ev.snooze = now + (act === "later" ? 5 : 3) * MIN;
      this.curKey = null;
      this.say(line.maid, pick(p?.[act], ev.key), "normal", now);
      return;
    }
    this.queue = this.queue.filter((e) => e !== ev);
    this.curKey = null;
    if (act === "report" || act === "dismiss") {
      if (act === "report") openOverlay({ mod: "maid-adv", kind: "dialog", width: 520, height: 560, props: { part: "report" } });
      this.say(line.maid, act === "report" ? "请过目。" : "好的，那明天再说吧。", "normal", now);
      return;
    }
    if (act === "home") {
      const list = agents();
      const st = { total: list.length, working: 0, blocked: 0, done: 0 };
      for (const a of list) if (st[a.status] != null) st[a.status] += 1;
      this.say(line.maid, RIN.report(st), "happy", now);
      return;
    }
    const up = addLove(ev.maid, 1);
    const reply = pick(p?.thanks, ev.key);
    this.say(line.maid, up ? `${reply}（好感度提升：${up}）` : reply, "happy", now);
  }

  // 在对话框里直接回复她：把文字发给她的终端；算作回应（好感 / 等待时间照算）
  async answer(line, text) {
    const now = Date.now();
    const ev = this.queue.find((e) => e.key === line.id);
    const term = panes().find((p) => p.pane === line.pane)?.terminal;
    if (!ev || !term || !text.trim()) return false;
    const args = ["send"];
    if (ev.kind === "blocked" || ev.kind === "angry") args.push("--force");
    args.push(term, text);
    const r = await hc(args);
    if (r.code !== 0) {
      this.say(line.maid, `呜……没能送到（${(r.stderr || r.stdout).trim().slice(0, 40)}）`, "ask", Date.now());
      return false;
    }
    this.queue = this.queue.filter((e) => e !== ev);
    this.curKey = null;
    const up = this.love(ev, now);
    record((s) => { s.replies += 1; });
    const p = PERSONA[line.maid];
    this.say(line.maid, up ? `${pick(p?.got, ev.key)}（好感度提升：${up}）` : pick(p?.got, ev.key), "happy", Date.now());
    return true;
  }

  // 排队头像被点：让她先说
  promote(key) {
    const ev = this.queue.find((e) => e.key === key);
    if (!ev) return;
    ev.snooze = 0;
    this.curKey = key;
    this.reply = null;
  }

  // AUTO：当前这位排到队尾
  rotate() {
    const i = this.queue.findIndex((e) => e.key === this.curKey);
    if (i < 0 || this.queue.length < 2) return;
    const [ev] = this.queue.splice(i, 1);
    this.queue.push(ev);
    this.curKey = null;
  }

  // SKIP：清空队列
  skip() {
    this.queue = [];
    this.curKey = null;
    this.reply = null;
  }
}
