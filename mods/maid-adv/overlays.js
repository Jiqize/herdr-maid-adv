// 浮层：章节选择（全部 space）、LOG（最近 60 句台词）、标题、CG 鉴赏、日报、本周回忆
import { div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, agents, run, props, closeOverlay, openOverlay } from "herdr";
import M from "./manifest.js";
import { CG_LINES, CG_LEVEL, LOVE_TITLES, reportComment } from "./lines.js";
import { STORIES, StoryPlayer, STORY_LEVEL } from "./story.js";
import { asset, assign, maidOf, readLog, STATUS_COLOR, STATUS_TEXT, crew, rin, cgUnlocked, loveOf, loveTitle, daily, dayStats, weekStart, storyState, markStory, businessDay } from "./state.js";

const close = () => { const id = props()?.overlay; if (id) closeOverlay(id); };

export function chapters(view, t) {
  const ags = agents();
  const mids = assign(ags);
  const row = (s, i) => {
    const mine = ags.filter((a) => a.space === s.id);
    return v_flex().id(`chap-${s.id}`).p(10).gap(6).rounded(10).cursor_pointer()
      .bg(s.active ? t.selected : t.surface).border(1).border_color(s.active ? t.accent : t.border)
      .hover((st) => st.border_color(t.accent))
      .on_click(() => { run("space.select", { id: s.id }); close(); })
      .child(h_flex().gap(8).items_center()
        .child(div().px(6).rounded(8).bg(t.accent).text_size(11).text_color(t.accent_foreground).child(`第 ${i + 1} 话`))
        .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(t.foreground).child(s.name))
        .when(i < 9, (el) => el.child(div().text_size(11).text_color(t.dim).child(`⌃${i + 1}`))))
      .child(h_flex().gap(4).items_center()
        .when(!mine.length, (el) => el.child(div().text_size(11).text_color(t.dim).child("这一话还没有女仆登场")))
        .children(mine.map((a) => {
          const m = maidOf(mids.get(a.address));
          return div().size(24).rounded_full().overflow_hidden().border(2).border_color(STATUS_COLOR[a.status] ?? m.color)
            .tooltip(`${m.name} · ${STATUS_TEXT[a.status] ?? ""}`).child(image(asset(m.head.normal)).size(20));
        })));
  };
  return v_flex().size_full().p(10).gap(8)
    .child(div().text_size(12).text_color(t.dim).child("章节选择"))
    .child(v_flex().id("chap-list").flex_1().min_h(0).gap(6).overflow_y_scrollbar().children(spaces().map(row)))
    .child(div().id("chap-new").h(32).flex().items_center().justify_center().rounded(10).cursor_pointer()
      .border(1).border_color(t.border).text_size(12).text_color(t.muted).hover((s) => s.bg(t.hover))
      .on_click(() => { run("space.new"); close(); }).child("＋ 开启新的一话"));
}

export function log(view, t) {
  const items = readLog().slice().reverse();
  const time = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  return v_flex().size_full().p(14).gap(10)
    .child(h_flex().justify_between().items_center()
      .child(div().text_size(14).font_weight(700).text_color(t.foreground).child("LOG · 回想"))
      .child(div().id("log-x").px(8).cursor_pointer().text_color(t.dim).hover((s) => s.text_color(t.foreground)).on_click(close).child("关闭")))
    .child(v_flex().id("log-list").flex_1().min_h(0).gap(8).overflow_y_scrollbar()
      .when(!items.length, (el) => el.child(div().text_size(12).text_color(t.dim).child("还没有对话")))
      .children(items.map((it, i) => {
        const m = maidOf(it.maid);
        return h_flex().id(`log-${i}`).gap(10).items_start()
          .child(div().size(36).flex_none().rounded_full().overflow_hidden().border(2).border_color(m.color).child(image(asset(m.head.normal)).size(32)))
          .child(v_flex().flex_1().min_w(0).gap(2)
            .child(h_flex().gap(6).child(div().text_size(12).font_weight(700).text_color(m.color).child(m.name))
              .child(div().text_size(11).text_color(t.dim).child(time(it.t))))
            .child(div().text_size(13).text_color(t.foreground).child(it.text)));
      })));
}

const open = (part, w, h, extra = {}, frame) => openOverlay({ mod: "maid-adv", kind: "dialog", width: w, height: h, ...(frame ? { frame } : {}), props: { part, ...extra } });

// 「11 月 3 日 星期二」（运行环境的 toLocaleDateString 不认 zh-CN 选项，手动拼）
const cnDate = (d) => `${d.getMonth() + 1} 月 ${d.getDate()} 日 星期${"日一二三四五六"[d.getDay()]}`;

// 标题画面：主视觉 + 标题字 + 菜单
export function title(view, t) {
  const item = (id, label, action) => h_flex().id(id).h(38).pl(14).pr(22).gap(10).items_center().rounded(19).cursor_pointer()
    .bg("#ffffffcc").border(2).border_color("#ef6f8e")
    .text_size(15).font_weight(700).text_color("#9a3048")
    .hover((s) => s.bg("#ef6f8e").text_color("#ffffff"))
    .on_click(action)
    .child(div().text_size(12).child("♥")).child(label);
  const logo = (dx, dy, color) => v_flex().absolute().left(44 + dx).top(40 + dy)
    .child(div().text_size(52).font_weight(800).text_color(color).child("女仆咖啡馆"))
    .child(div().pl(4).text_size(20).font_weight(700).text_color(color).child("～ Café Herdr 物语 ～"));
  return div().size_full().relative().rounded(16).overflow_hidden().bg("#fdf1f4")
    .child(image(asset(M.keyvisual)).absolute().left(0).top(0).w(960).h(540))
    .child(div().absolute().left(0).top(0).w(520).h(200).bg("#ffffff59"))
    .child(logo(-2, 0, "#ffffff")).child(logo(2, 0, "#ffffff")).child(logo(0, -2, "#ffffff")).child(logo(0, 2, "#ffffff"))
    .child(logo(3, 4, "#ffffff"))
    .child(logo(0, 0, "#d23a6a"))
    .child(v_flex().absolute().right(36).bottom(36).gap(8).items_end()
      .child(item("t-start", "开始营业", close))
      .child(item("t-cg", "CG 鉴赏", () => { close(); open("gallery", 960, 600); }))
      .child(item("t-report", "营业日报", () => { close(); open("report", 520, 560); }))
      .child(item("t-cfg", "设置", () => { close(); run("app.settings"); })))
    .child(div().absolute().left(44).bottom(28).px(10).py(2).rounded(10).bg("#d23a6acc").text_size(12).text_color("#ffffff").child(`${cnDate(new Date())} · 营业第 ${props()?.demo?.day ?? businessDay()} 天`));
}

// CG 大图：解锁时有横幅；点哪里都关闭
export function cgview(view, t) {
  const mid = props()?.maid;
  const m = maidOf(mid);
  const unlock = props()?.unlock;
  return div().id("cg-view").size_full().relative().rounded(16).overflow_hidden().bg("#000000").cursor_pointer()
    .on_click(close)
    .child(image(asset(M.cg[mid].full)).absolute().left(0).top(0).w(960).h(540))
    .when(Boolean(unlock), (el) => el.child(h_flex().absolute().left(0).right(0).top(20).justify_center()
      .child(div().px(18).py(6).rounded(18).bg("#ef6f8ee6").text_size(15).font_weight(700).text_color("#ffffff")
        .child(`CG 解锁！— 与${m.name}的回忆`))))
    .child(v_flex().absolute().left(0).right(0).bottom(0).h(60).px(20).justify_center().bg("#1d1622")
      .child(h_flex().gap(10).items_center()
        .child(div().px(10).rounded(10).bg(m.color).text_size(13).font_weight(700).text_color("#ffffff").child(m.name))
        .child(div().text_size(14).text_color("#f3e3ea").child((CG_LINES[mid] ?? [""])[0]))));
}

// CG 鉴赏室：8 格，未解锁的显示剪影和进度
export function gallery(view, t, cx) {
  const got = props()?.all ? Object.fromEntries(crew().filter((m, i) => i % 3 !== 2).map((m) => [m.id, 1])) : cgUnlocked();
  const cell = (m) => {
    const ok = Boolean(got[m.id]);
    const pts = loveOf(m.id);
    return v_flex().id(`cg-${m.id}`).w(214).gap(4).cursor_pointer()
      .on_click(() => { if (ok) open("cgview", 960, 600, { maid: m.id }, "none"); })
      .child(div().relative().w(214).h(120).rounded(10).overflow_hidden().border(2).border_color(ok ? m.color : t.border)
        .hover((s) => s.border_color(t.accent))
        .child(image(asset(ok ? M.cg[m.id].thumb : M.cg[m.id].locked)).w(214).h(120))
        .when(!ok, (el) => el.child(div().absolute().left(0).top(0).w(214).h(120).flex().items_center().justify_center()
          .text_size(22).font_weight(800).text_color("#ffffffcc").child("？？？"))))
      .child(h_flex().justify_between().items_center()
        .child(div().text_size(12).font_weight(700).text_color(m.color).child(m.name))
        .child(div().text_size(11).text_color(t.dim).child(ok ? "已解锁" : `${loveTitle(pts)} ${pts}/${CG_LEVEL * 5}`)))
      .child(storyRow(m, t));
  };
  // 个人剧情：解锁后可以重看，显示读到了几个结局
  const storyRow = (m, t) => {
    const st = storyState()[m.id];
    const s = STORIES[m.id];
    if (!s) return div();
    if (!st?.unlocked) return div().text_size(11).text_color(t.dim).child(`剧情「？？？」· ${LOVE_TITLES[STORY_LEVEL]}解锁`);
    const n = (st.good ? 1 : 0) + (st.bad ? 1 : 0);
    return div().id(`story-${m.id}`).text_size(11).text_color(m.color).cursor_pointer().hover((x) => x.text_color(t.foreground))
      .on_click(() => open("story", 960, 600, { maid: m.id }, "none"))
      .child(`▶ 剧情「${s.title}」· 结局 ${n}/2`);
  };
  const n = crew().filter((m) => got[m.id]).length;
  return v_flex().size_full().p(18).gap(12)
    .child(h_flex().justify_between().items_center()
      .child(h_flex().gap(10).items_center()
        .child(div().text_size(16).font_weight(800).text_color(t.foreground).child("CG 鉴赏"))
        .child(div().text_size(12).text_color(t.dim).child(`${n} / ${crew().length} · 好感度达到「${LOVE_TITLES[CG_LEVEL]}」解锁`)))
      .child(div().id("cg-x").px(8).cursor_pointer().text_color(t.dim).hover((s) => s.text_color(t.foreground)).on_click(close).child("关闭")))
    .child(h_flex().flex_wrap().gap(12).children(crew().map(cell)));
}

// 营业日报：女仆长汇报今天的数字
export function report(view, t) {
  const d = daily();
  const r = rin();
  const avg = d.waitN ? d.waitSum / d.waitN / 60000 : 0;
  const mins = (ms) => (ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))} 秒` : `${Math.round(ms / 60000)} 分钟`);
  const mvp = Object.entries(d.by).sort((a, b) => b[1] - a[1])[0];
  const row = (label, value, color = t.foreground) => h_flex().h(34).px(12).items_center().justify_between().rounded(8).bg(t.surface)
    .child(div().text_size(13).text_color(t.muted).child(label))
    .child(div().text_size(14).font_weight(700).text_color(color).child(value));
  const dt = new Date();
  return v_flex().size_full().p(18).gap(10)
    .child(h_flex().gap(12).items_center()
      .child(div().size(56).rounded_full().overflow_hidden().border(2).border_color(r.color).child(image(asset(r.head.happy)).size(52)))
      .child(v_flex().flex_1().gap(2)
        .child(div().text_size(16).font_weight(800).text_color(t.foreground).child(`营业日报 · ${dt.getMonth() + 1} 月 ${dt.getDate()} 日`))
        .child(div().text_size(12).text_color(t.dim).child("女仆长 铃 整理")))
      .child(div().id("rp-x").px(8).cursor_pointer().text_color(t.dim).hover((s) => s.text_color(t.foreground)).on_click(close).child("关闭")))
    .child(row("上菜（完成）", `${d.done} 份`, "#ef4f7e"))
    .child(row("被呼叫（等您吩咐）", `${d.blocked} 次`, "#c99a1e"))
    .child(row("平均响应", d.waitN ? mins(d.waitSum / d.waitN) : "—"))
    .child(row("最久的一次等待", d.longest ? `${maidOf(d.longest.maid).name} · ${mins(d.longest.ms)}` : "—"))
    .child(row("今日 MVP", mvp ? `${maidOf(mvp[0]).name} · 完成 ${mvp[1]} 件` : "—", mvp ? maidOf(mvp[0]).color : t.foreground))
    .child(row("在对话框里直接回复", `${d.replies} 次`))
    .child(row("今天收获的好感", `♥ ${d.love}`, "#ef4f7e"))
    .child(div().mt(6).p(12).rounded(10).bg(`${r.color}1a`).border(1).border_color(`${r.color}66`)
      .text_size(13).text_color(t.foreground).child(`「${reportComment(avg, d.done + d.blocked)}」`));
}

// 本周回忆：周一到周日每天的完成数、本周 MVP、本周解锁的 CG
//   demo：props.demo.days = 7 个 {done, by}，props.demo.cg = [女仆 id]
export function week(view, t) {
  const demo = props()?.demo;
  const ws = weekStart();
  const today = new Date().getDay();
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const s = demo?.days ? demo.days[i] : d.getTime() <= Date.now() ? dayStats(d.getTime()) : null;
    return { label: "一二三四五六日"[i], s, today: (i + 1) % 7 === today };
  });
  const max = Math.max(1, ...days.map((d) => d.s?.done ?? 0));
  const by = {};
  for (const d of days) for (const [mid, n] of Object.entries(d.s?.by ?? {})) by[mid] = (by[mid] ?? 0) + n;
  const mvp = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  const total = days.reduce((n, d) => n + (d.s?.done ?? 0), 0);
  const cgs = demo?.cg ?? Object.entries(cgUnlocked()).filter(([, ts]) => ts >= ws).map(([mid]) => mid);
  const r = rin();
  const H = 130;
  const bar = (d, k) => v_flex().id(`wk-${k}`).flex_1().items_center().gap(4)
    .child(div().text_size(11).text_color(t.dim).child(d.s ? String(d.s.done) : ""))
    .child(div().h(H).w_full().flex().flex_col().justify_end().items_center()
      .child(div().w(26).rounded_t(6).h(Math.max(d.s?.done ? 4 : 0, Math.round(H * (d.s?.done ?? 0) / max)))
        .bg(d.today ? "#ef4f7e" : `${r.color}aa`)))
    .child(div().text_size(12).font_weight(d.today ? 800 : 400).text_color(d.today ? "#ef4f7e" : t.muted).child(d.label));
  const m = mvp ? maidOf(mvp[0]) : null;
  return v_flex().size_full().p(18).gap(12)
    .child(h_flex().gap(12).items_center()
      .child(div().size(48).rounded_full().overflow_hidden().border(2).border_color(r.color).child(image(asset(r.head.happy)).size(44)))
      .child(v_flex().flex_1().gap(2)
        .child(div().text_size(16).font_weight(800).text_color(t.foreground).child("本周回忆"))
        .child(div().text_size(12).text_color(t.dim).child(`这周一共完成了 ${total} 件工作`)))
      .child(div().id("wk-x").px(8).cursor_pointer().text_color(t.dim).hover((s) => s.text_color(t.foreground)).on_click(close).child("关闭")))
    .child(h_flex().p(12).gap(6).rounded(10).bg(t.surface).children(days.map(bar)))
    .child(h_flex().gap(12).items_stretch()
      .child(v_flex().w(220).flex_none().p(12).gap(6).rounded(10).bg(t.surface)
        .child(div().text_size(12).text_color(t.muted).child("本周 MVP"))
        .child(m
          ? h_flex().gap(10).items_center()
            .child(div().size(52).rounded_full().overflow_hidden().border(2).border_color(m.color).child(image(asset(m.head.happy)).size(48)))
            .child(v_flex().gap(2)
              .child(div().text_size(15).font_weight(800).text_color(m.color).child(m.name))
              .child(div().text_size(12).text_color(t.dim).child(`完成 ${mvp[1]} 件`)))
          : div().text_size(13).text_color(t.dim).child("这周还没有完成的工作")))
      .child(v_flex().flex_1().min_w(0).p(12).gap(6).rounded(10).bg(t.surface)
        .child(div().text_size(12).text_color(t.muted).child(`本周解锁的 CG · ${cgs.length} 张`))
        .child(cgs.length
          ? h_flex().flex_wrap().gap(6).children(cgs.filter((mid) => M.cg[mid]).map((mid) => div().w(96).h(54).rounded(6).overflow_hidden()
            .border(1).border_color(maidOf(mid).color).child(image(asset(M.cg[mid].thumb)).w(96).h(54))))
          : div().text_size(13).text_color(t.dim).child("这周还没有解锁新的 CG"))));
}

// 剧情浮层：背景 + 她的立绘 + 对话框；点对话框往下走，第 2 幕结尾选一个回答，好结局最后看 CG
//   demo：props.demo = { at: 第几步, good: true / false }
export function story(view, t, cx) {
  const mid = props()?.maid;
  const s = STORIES[mid];
  if (!s) return div();
  const demo = props()?.demo;
  if (!view.player) {
    view.player = new StoryPlayer(s);
    if (demo) { view.player.good = demo.good ?? null; view.player.pos = demo.at ?? 0; }
  }
  const p = view.player;
  const st = p.step();
  const m = maidOf(mid);
  const W = 960, H = 600;
  const go = (_e, cx) => { if (p.next()) cx.notify(); };

  // 读完记一笔（哪个结局读过）
  if (st.kind === "end" && !demo && view.recorded !== st.good) {
    view.recorded = st.good;
    markStory(mid, { unlocked: storyState()[mid]?.unlocked ?? Date.now(), [st.good ? "good" : "bad"]: Date.now() });
  }

  if (st.kind === "cg") {
    return div().id("story-cg").w(W).h(H).relative().rounded(16).overflow_hidden().bg("#000000").cursor_pointer().on_click(go)
      .child(image(asset(M.cg[mid].full)).absolute().left(0).top(0).w(W).h(540))
      .child(h_flex().absolute().left(0).right(0).bottom(0).h(60).px(20).gap(10).items_center().bg("#1d1622")
        .child(div().px(10).rounded(10).bg(m.color).text_size(13).font_weight(700).text_color("#ffffff").child(m.name))
        .child(div().flex_1().text_size(14).text_color("#f3e3ea").child((CG_LINES[mid] ?? [""])[0]))
        .child(div().text_size(12).text_color("#f3e3ea99").child("▼")));
  }

  const bgUrl = (st.bg ?? "day") === "night" ? M.bg.night : M.bg.day;
  const [bw, bh] = M.bg.size;
  const BH = Math.round(W * bh / bw);
  const scene = div().absolute().left(0).top(0).w(W).h(H).overflow_hidden()
    .child(image(asset(bgUrl)).absolute().left(0).top(-Math.round((BH - H) * 0.35)).w(W).h(BH));

  if (st.kind === "end") {
    const item = (id, label, action) => div().id(id).h(36).px(20).flex().items_center().rounded(18).cursor_pointer()
      .bg("#ffffffdd").border(2).border_color(m.color).text_size(14).font_weight(700).text_color(m.color)
      .hover((x) => x.bg(m.color).text_color("#ffffff")).on_click(action).child(label);
    return div().w(W).h(H).relative().rounded(16).overflow_hidden().bg("#000000")
      .child(scene)
      .child(div().absolute().left(0).top(0).w(W).h(H).bg("#1d1622b3"))
      .child(v_flex().absolute().left(0).top(0).w(W).h(H).gap(14).items_center().justify_center()
        .child(div().text_size(14).text_color("#f3e3eacc").child(`${m.name}的剧情「${s.title}」`))
        .child(div().text_size(34).font_weight(800).text_color("#ffffff").child("—— 完 ——"))
        .child(div().px(14).py(4).rounded(12).bg(st.good ? "#ef4f7ecc" : "#8a7a90cc").text_size(13).text_color("#ffffff")
          .child(st.good ? "好结局 · 回忆 CG 已收藏" : "普通结局 · 换一个回答试试？"))
        .child(h_flex().mt(10).gap(12)
          .child(item("st-again", "再看一次", (_e, cx) => { p.restart(); view.recorded = undefined; cx.notify(); }))
          .child(item("st-close", "关闭", close))));
  }

  const narr = st.kind === "line" && st.mood === "-";
  const mood = st.kind === "line" && !narr && m.tachie[st.mood] ? st.mood : st.kind === "choice" ? "ask" : "normal";
  const [w0, h0] = m.size;
  const TH = 560, TW = Math.round(w0 * TH / h0);
  const choice = (c, i) => div().id(`st-ch-${i}`).h(36).px(18).flex().items_center().rounded(18).cursor_pointer()
    .bg("#fffafbee").border(2).border_color(m.color).text_size(14).text_color("#4a3040")
    .hover((x) => x.bg(m.color).text_color("#ffffff"))
    .on_click((_e, cx) => { if (p.choose(i)) cx.notify(); })
    .child(`▶ ${c.label}`);
  // 分支时对话框里留着她刚问的那句
  const text = st.kind === "choice" ? s.acts[s.acts.length - 1].lines.at(-1).text : st.text;

  return div().w(W).h(H).relative().rounded(16).overflow_hidden().bg("#000000")
    .child(scene)
    .child(div().id(`st-tachie-${mood}`).absolute().left(Math.round((W - TW) / 2)).top(40).w(TW).h(TH).opacity(narr ? 0.55 : 1)
      .child(image(asset(m.tachie[mood])).w(TW).h(TH)))
    // 左上：第几幕 · 标题
    .child(div().absolute().left(20).top(16).px(12).py(3).rounded(12).bg("#1d1622b3").text_size(12).text_color("#ffffff")
      .child(`第 ${Math.min(st.act ?? 3, 3)} 幕 · ${s.title}`))
    .child(div().id("st-x").absolute().right(18).top(14).px(10).py(3).rounded(12).bg("#1d1622b3").cursor_pointer()
      .text_size(12).text_color("#ffffffcc").hover((x) => x.text_color("#ffffff")).on_click(close).child("关闭"))
    .when(st.kind === "choice", (el) => el.child(v_flex().absolute().left(0).right(0).top(190).gap(12).items_center()
      .children(st.choices.map(choice))))
    .child(v_flex().id("st-box").absolute().left(24).right(24).bottom(20).h(140).cursor_pointer().on_click(go)
      .when(!narr, (el) => el.child(h_flex().ml(22).h(26).px(12).items_center().rounded_t(12).bg(m.color).self_start()
        .text_size(14).font_weight(700).text_color("#ffffff").child(m.name)))
      .child(div().flex_1().relative().px(24).pt(18).rounded(16).bg("#fffafbee").border(2).border_color(narr ? "#b8a8b0" : m.color)
        .when(narr, (el) => el.mt(26))
        .child(div().text_size(17).line_height("30px").text_color(narr ? "#7a6070" : "#3a2632").child(text))
        .when(st.kind === "line", (el) => el.child(div().id("st-next").absolute().right(16).bottom(10).text_size(12).text_color(m.color)
          .loop("opacity", { from: 0.2, to: 1, period: 700 }).child("▼")))));
}
