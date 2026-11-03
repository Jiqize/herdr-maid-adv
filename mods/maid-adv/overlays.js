// 两个浮层：章节选择（全部 space）、LOG（最近 60 句台词）
import { div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, agents, run, props, closeOverlay, openOverlay } from "herdr";
import M from "./manifest.js";
import { CG_LINES, CG_LEVEL, LOVE_TITLES, reportComment } from "./lines.js";
import { asset, assign, maidOf, readLog, STATUS_COLOR, STATUS_TEXT, crew, rin, cgUnlocked, loveOf, loveTitle, daily } from "./state.js";

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
    .child(div().absolute().left(44).bottom(28).px(10).py(2).rounded(10).bg("#d23a6acc").text_size(12).text_color("#ffffff").child(new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" }) + " · 今日营业中"));
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
        .child(div().text_size(11).text_color(t.dim).child(ok ? "已解锁" : `${loveTitle(pts)} ${pts}/${CG_LEVEL * 5}`)));
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
