// 共享的小工具：素材路径、昼夜、女仆分配、好感度
import { shared, setShared, spaces, props } from "herdr";
import M from "./manifest.js";
import { LOVE_TITLES } from "./lines.js";

const ASSETS = "mods/maid-adv/assets";

export function isNight(t) {
  const hex = (t.background ?? "#ffffff").slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}

export const asset = (name) => `${ASSETS}/${name}`;
export const HOT = (s) => s === "done" || s === "blocked";
export const STATUS_COLOR = { idle: "#b8a8b0", working: "#f29b6b", done: "#ef4f7e", blocked: "#e8b72f" };
export const STATUS_TEXT = { idle: "待命", working: "忙碌中", done: "做好了", blocked: "等吩咐" };

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const f = find(child, id);
    if (f) return f;
  }
  return null;
}

// 季节服装：到了日期自动换装（立绘、头像一起换；换装期间没有眨眼 / 口型差分）
//   以后加万圣节、夏日浴衣：在这里加一行，并在 art/build.py 的 OUTFITS 登记动作表
export const OUTFITS = [
  { id: "xmas", from: [12, 18], to: [12, 26] },
];
// demo props 里的 date（如 "2026-12-24"）只给截图用，假装今天是那天
export function today() {
  const d = props()?.demo?.date;
  return d ? new Date(`${d}T12:00:00`) : new Date();
}
export function outfitOn(date = today()) {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  return OUTFITS.find((o) => md >= o.from[0] * 100 + o.from[1] && md <= o.to[0] * 100 + o.to[1])?.id ?? null;
}

// 女仆：M.maids 里 rin 是女仆长（旁白），不分配给 Agent
export function maidOf(id) {
  const m = M.maids.find((x) => x.id === id) ?? M.maids[0];
  const o = outfitOn();
  return o && m.outfits?.[o] ? { ...m, ...m.outfits[o], patch: {}, outfit: o } : m;
}
export const crew = () => M.maids.filter((m) => !m.narrator);
export const rin = () => M.maids.find((m) => m.narrator) ?? M.maids[0];

const KEY = "adv.maids";
// Agent 按出现顺序依次分配女仆，循环使用；存 shared，各部件看到同一位
export function assign(list) {
  const old = shared(KEY) ?? { map: {}, n: 0 };
  const pool = crew();
  const map = {};
  let n = old.n ?? 0;
  let changed = false;
  for (const a of list) {
    if (old.map?.[a.address]) map[a.address] = old.map[a.address];
    else {
      map[a.address] = pool[n % pool.length].id;
      n += 1;
      changed = true;
    }
  }
  if (Object.keys(old.map ?? {}).some((k) => !(k in map))) changed = true;
  if (changed) setShared(KEY, { map, n });
  return new Map(Object.entries(map));
}

// ---------- 好感度 ----------
const LOVE = "adv.love";
export const loveOf = (mid) => (shared(LOVE) ?? {})[mid] ?? 0;
export const loveLevel = (pts) => Math.min(LOVE_TITLES.length - 1, Math.floor(pts / 5));
export const loveTitle = (pts) => LOVE_TITLES[loveLevel(pts)];

// 返回升级后的称号（没升级返回 null）
export function addLove(mid, d) {
  if (!d) return null;
  const all = { ...(shared(LOVE) ?? {}) };
  const before = all[mid] ?? 0;
  const after = Math.max(0, Math.min(5 * (LOVE_TITLES.length - 1) + 4, before + d));
  all[mid] = after;
  setShared(LOVE, all);
  return loveLevel(after) > loveLevel(before) ? LOVE_TITLES[loveLevel(after)] : null;
}

// 座位：有意义的 tab 名，否则 space 名
export function where(a) {
  const tab = a.tab_name ?? "";
  const prog = a.program?.name ?? "";
  if (tab && !/^(tb)?\d+$/.test(tab) && tab.toLowerCase() !== prog.toLowerCase()) return `${a.space_name} · ${tab}`;
  return a.space_name ?? "";
}

export const chapterOf = (spaceId) => spaces().findIndex((s) => s.id === spaceId) + 1;

const LOG = "adv.log";
export function pushLog(line) {
  const log = (shared(LOG) ?? []).slice(-59);
  log.push({ t: Date.now(), maid: line.maid, text: line.text });
  setShared(LOG, log);
}
export const readLog = () => shared(LOG) ?? [];

// ---------- 营业日报 ----------
// shared("adv.daily")：当天的统计，跨天自动重置；旧的一天归档进 shared("adv.history")（最近 14 天）
const DAILY = "adv.daily";
const HISTORY = "adv.history";
export const dayKey = (t = Date.now()) => new Date(t).toDateString();
export function daily() {
  const day = dayKey();
  const s = shared(DAILY);
  if (s && s.day === day) return s;
  if (s && !history().some((h) => h.day === s.day)) {
    const { day: d, done, blocked, by, longest } = s;
    setShared(HISTORY, [...history(), { day: d, done, blocked, by, longest }].slice(-14));
  }
  return { day, done: 0, blocked: 0, waitSum: 0, waitN: 0, longest: null, by: {}, replies: 0, love: 0 };
}
export const history = () => shared(HISTORY) ?? [];
// 某一天的日报（今天取当天统计，以前的取归档）
export function dayStats(t) {
  const day = dayKey(t);
  if (day === dayKey()) return daily();
  daily();
  return history().find((h) => h.day === day) ?? null;
}
// 本周一 0 点
export function weekStart(t = Date.now()) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
export function record(fn) {
  const s = JSON.parse(JSON.stringify(daily()));
  fn(s);
  setShared(DAILY, s);
}

// ---------- CG ----------
export const cgUnlocked = () => shared("adv.cg") ?? {};
export function unlockCg(mid) {
  setShared("adv.cg", { ...cgUnlocked(), [mid]: Date.now() });
}
