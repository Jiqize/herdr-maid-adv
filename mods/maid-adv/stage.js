// 舞台：咖啡馆插画背景 + 正在说话的那位女仆的半身立绘（表情差分、呼吸、换人滑入、表情符号）
//   顶部「当班」一排：所有 Agent 的女仆小头像 + 状态环，点谁跳到谁的窗格
//   说话的人由对话框写进 shared("adv.speaker")；人再多，舞台上也只站一位
import { div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, shared, props, run } from "herdr";
import M from "./manifest.js";
import { asset, isNight, maidOf, assign, STATUS_COLOR, STATUS_TEXT, where } from "./state.js";

const STAGE_W = 360;
const TACHIE_H = 620;
const FX = { happy: "heart", ask: "sweat", pout: "anger" };

export function stage(view, t, cx) {
  const demo = props()?.demo;
  const sp = demo?.speaker ?? shared("adv.speaker") ?? { maid: "rin", mood: "normal" };
  const m = maidOf(sp.maid);
  const night = isNight(t);
  const [bw, bh] = M.bg.size;
  // 背景放大到 560 宽后居中裁切，竖向足够铺满
  const BW = 560, BH = Math.round(560 * bh / bw);

  // 换人：先画在右侧透明处，40ms 后滑回原位
  const st = (view.stage ??= { maid: null, enter: false });
  if (st.maid !== m.id) {
    st.enter = st.maid != null;
    st.maid = m.id;
    if (st.enter) cx.timer.after(40, (cx) => { st.enter = false; cx.notify(); });
  }

  const [w0, h0] = m.size;
  const TW = Math.round(w0 * TACHIE_H / h0);
  const mood = m.tachie[sp.mood] ? sp.mood : "normal";
  const fxName = FX[mood];
  let fxEl = null;
  if (fxName) {
    const [fw, fh] = M.fxSize[fxName];
    const fx = m.face[0] * TW + (mood === "happy" ? 46 : 38);
    const fy = m.face[1] * TACHIE_H - (mood === "happy" ? 70 : 60);
    fxEl = div().absolute().left(fx).top(fy).w(fw).h(fh)
      .child(div().id(`fx-${m.id}-${mood}`).absolute().left(0).top(0)
        .loop("top", { from: 0, to: -6, period: mood === "pout" ? 360 : 900 })
        .child(image(asset(M.fx[fxName])).w(fw).h(fh)));
  }

  const left = Math.round((STAGE_W - TW) / 2);
  const portrait = div().id("adv-tachie").absolute().bottom(-40).w(TW).h(TACHIE_H)
    .left(st.enter ? left + 60 : left).opacity(st.enter ? 0 : 1)
    .transition("left", { duration: 420, easing: "ease-out" })
    .transition("opacity", { duration: 320, easing: "ease-out" })
    .cursor_pointer()
    .on_click(() => sp.pane && run("pane.focus", { pane: sp.pane }))
    .child(div().id("adv-breath").absolute().left(0).top(0).w(TW).h(TACHIE_H)
      .loop("top", { from: 0, to: -3, period: 3400 })
      .child(image(asset(m.tachie[mood])).w(TW).h(TACHIE_H))
      .when(Boolean(fxEl), (el) => el.child(fxEl)));

  // 当班一排
  const list = demo?.crew ?? agents();
  const mids = demo ? null : assign(list);
  const crew = h_flex().flex_wrap().gap(6).children(list.map((a) => {
    const cm = maidOf(demo ? a.maid : mids.get(a.address));
    const speaking = demo ? cm.id === m.id : a.address === sp.address;
    const ring = STATUS_COLOR[a.status] ?? STATUS_COLOR.idle;
    let head = div().size(34).rounded_full().overflow_hidden().border(2).border_color(ring).bg("#ffffff")
      .child(image(asset(cm.head[a.status === "blocked" ? "ask" : a.status === "done" ? "happy" : "normal"])).size(30));
    if (a.status === "working") head = div().id(`crew-b-${a.address}`).loop("top", { from: 0, to: -2, period: 900 }).child(head);
    return div().id(`crew-${a.address}`).relative().size(36).cursor_pointer()
      .tooltip(`${cm.name} · ${a.program?.name ?? a.app ?? "Agent"} · ${STATUS_TEXT[a.status] ?? ""}${a.space_name ? ` · ${where(a)}` : ""}`)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(() => a.pane && run("pane.focus", { pane: a.pane }))
      .child(head)
      .when(speaking, (el) => el.child(div().absolute().left(13).top(-7).size(8).rounded_full().bg("#ff5f8f")));
  }));

  return div().size_full().relative().overflow_hidden().bg(night ? "#1b1426" : "#f6d9e0")
    .child(image(asset(night ? M.bg.night : M.bg.day)).absolute().left(Math.round((STAGE_W - BW) / 2)).top(0).w(BW).h(BH))
    // 底部渐暗，让立绘和对话框接得自然
    .child(div().absolute().left(0).right(0).bottom(0).h(140).bg(night ? "#150f1966" : "#ffffff40"))
    .child(portrait)
    .child(v_flex().absolute().left(10).right(10).top(10).gap(4)
      .child(h_flex().gap(6).items_center()
        .child(div().px(6).py(1).rounded(6).bg(night ? "#00000080" : "#ffffffcc").text_size(11).text_color(t.muted)
          .child(list.length ? `今日当班 ${list.length} 人` : "今日还没有女仆当班")))
      .child(crew));
}
