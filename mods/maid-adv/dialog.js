// 对话框：名牌 + 好感度、打字机逐字显示、选项按钮、排队头像、LOG / AUTO / SKIP / 设置
//   对话框这一份持有导演（engine.js），并把「谁在说话」写进 shared("adv.speaker") 给舞台和窗格头读
import { div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { shared, setShared, props, run, openOverlay } from "herdr";
import M from "./manifest.js";
import { asset, isNight, maidOf, loveOf, loveLevel, loveTitle, pushLog } from "./state.js";
import { PERSONA } from "./lines.js";

const STEP_MS = 32;
const AUTO_MS = 6000;
const stop = (_e, cx) => cx.stop_propagation();

function hearts(pts, color) {
  const lv = loveLevel(pts);
  return h_flex().gap(1).children([0, 1, 2, 3, 4].map((k) =>
    div().text_size(11).text_color(k < lv ? color : "#ffffff80").child("♥")));
}

// 打字机：每 32ms 多显示 2 个字，显示完就停（不做周期性重绘）
function typing(view, line, cx) {
  const tw = (view.tw ??= { id: null, n: 0, ticking: false });
  const chars = Array.from(line.text);
  if (tw.id !== line.id) {
    tw.id = line.id;
    tw.n = 0;
    if (!line.demo) pushLog(line);
  }
  if (tw.n < chars.length && !tw.ticking) {
    tw.ticking = true;
    cx.timer.after(STEP_MS, (cx) => { tw.ticking = false; tw.n += 2; cx.notify(); });
  }
  return { shown: chars.slice(0, tw.n).join(""), done: tw.n >= chars.length, finish: () => { tw.n = chars.length; } };
}

export function dialog(view, t, cx) {
  const demo = props()?.demo;
  const night = isNight(t);
  let line, queue;
  if (demo) {
    line = { ...demo.line, id: "demo", demo: true };
    queue = (demo.queue ?? []).map((maid, i) => ({ key: `q${i}`, maid, kind: "done" }));
  } else {
    const r = view.director.update(cx);
    line = r.line;
    queue = r.queue;
    // 谁在说话 → 舞台和窗格头
    const sp = { maid: line.maid, mood: line.mood, address: line.address ?? null, pane: line.pane ?? null };
    const old = shared("adv.speaker");
    if (!old || old.maid !== sp.maid || old.mood !== sp.mood || old.address !== sp.address || old.pane !== sp.pane) setShared("adv.speaker", sp);
  }
  const m = maidOf(line.maid);
  const tw = typing(view, line, cx);
  const auto = Boolean(shared("adv.auto"));
  if (!demo && auto && tw.done && queue.length && view.autoFor !== line.id) {
    view.autoFor = line.id;
    cx.timer.after(AUTO_MS, (cx) => { if (view.tw?.id === line.id) view.director.rotate(); cx.notify(); });
  }

  const pts = loveOf(m.id);
  const persona = PERSONA[m.id];
  const plate = h_flex().flex_none().ml(22).h(26).pl(12).pr(10).gap(8).items_center().rounded_t(12)
    .bg(m.color)
    .child(div().text_size(14).font_weight(700).text_color("#ffffff").child(m.name))
    .child(div().text_size(11).text_color("#ffffffcc").child(m.narrator ? "女仆长" : `${persona?.title ?? ""} · ${loveTitle(pts)}`))
    .when(!m.narrator, (el) => el.child(hearts(pts, "#ffffff")));

  const choice = (c, i) => div().id(`ch-${i}`).h(30).px(14).flex().items_center().rounded(15).cursor_pointer()
    .bg(night ? "#2e2236" : "#ffffff").border(2).border_color(m.color)
    .text_size(13).text_color(t.foreground)
    .hover((s) => s.bg(m.color).text_color("#ffffff"))
    .on_mouse_down("left", stop)
    .on_click((_e, cx) => { if (!demo) { view.director.choose(line, c.act); cx.notify(); } })
    .child(`▶ ${c.label}`);

  const text = div().relative().flex_1().min_w(0).pt(20).pl(24).pr(12).pb(8)
    .child(div().w_full().text_size(15).line_height("26px").text_color(t.foreground).child(tw.shown || " "))
    .when(tw.done, (el) => el.child(div().id("adv-next").absolute().right(8).bottom(6).text_size(12).text_color(m.color)
      .loop("opacity", { from: 0.2, to: 1, period: 700 }).child("▼")));

  const choices = v_flex().w(200).flex_none().pt(16).pr(16).gap(6).items_end()
    .when(tw.done, (el) => el.children(line.choices.map(choice)));

  const box = v_flex().id("adv-box").relative().flex_1().min_h(0).rounded(16)
    .bg(night ? "#221a28e8" : "#fffafbee").border(2).border_color(m.color)
    .cursor_pointer()
    .on_click((_e, cx) => { tw.finish(); cx.notify(); })
    .child(h_flex().flex_1().min_h(0).items_start().child(text).child(choices));

  // 排队头像：点谁谁先说
  const qhead = (ev) => {
    const qm = maidOf(ev.maid);
    return div().id(`q-${ev.key}`).size(28).rounded_full().overflow_hidden().border(2)
      .border_color(ev.kind === "blocked" || ev.kind === "angry" ? "#e8b72f" : ev.kind === "done" ? "#ef4f7e" : qm.color)
      .cursor_pointer().tooltip(`${qm.name} 想跟主人说话`)
      .on_mouse_down("left", stop)
      .on_click((_e, cx) => { if (!demo) { view.director.promote(ev.key); cx.notify(); } })
      .child(image(asset(qm.head.normal)).size(24));
  };

  const menuItem = (id, label, on, action) => div().id(id).px(6).cursor_pointer().text_size(11)
    .text_color(on ? m.color : t.dim).hover((s) => s.text_color(t.foreground))
    .on_mouse_down("left", stop).on_click(action).child(label);

  const bar = h_flex().h(30).flex_none().px(10).items_center().justify_between()
    .child(h_flex().gap(6).items_center()
      .child(div().text_size(11).text_color(t.dim).child(queue.length ? `排队 ${queue.length}` : "没有人在排队"))
      .children(queue.slice(0, 12).map(qhead))
      .when(queue.length > 12, (el) => el.child(div().text_size(11).text_color(t.dim).child(`+${queue.length - 12}`))))
    .child(h_flex().gap(2).items_center()
      .child(menuItem("m-log", "LOG", false, () => openOverlay({ mod: "maid-adv", kind: "dialog", width: 560, height: 600, props: { part: "log" } })))
      .child(menuItem("m-auto", "AUTO", auto, () => setShared("adv.auto", !auto)))
      .child(menuItem("m-skip", "SKIP", false, (_e, cx) => { if (!demo) { view.director.skip(); cx.notify(); } }))
      .child(menuItem("m-cfg", "CONFIG", false, () => run("app.settings"))));

  return v_flex().size_full().bg(t.canvas).px(12).pt(4)
    .child(h_flex().child(plate))
    .child(box)
    .child(bar);
}
