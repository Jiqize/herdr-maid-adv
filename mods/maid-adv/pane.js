// 窗格头部：女仆圆头像 +「小夜 · Claude Code」+ 目录；正在说话那位的窗格头亮成她的颜色；等吩咐标签
import { div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, agents, props, run, home, shared } from "herdr";
import { asset, assign, maidOf, STATUS_COLOR } from "./state.js";

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export function paneHeader(view, t) {
  const pane = props()?.pane;
  const p = panes().find((x) => x.pane === pane);
  if (!p) return div();
  const a = agents().find((x) => x.pane === pane);
  const m = a ? maidOf(assign(agents()).get(a.address)) : null;
  const speaking = Boolean(m) && shared("adv.speaker")?.pane === pane;
  const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
  const hovered = view.hovered === pane;
  const button = (id, icon, command, args) => div().id(id).size(20).flex_none().flex().items_center().justify_center().rounded(4)
    .text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
    .on_click((_e, cx) => { cx.stop_propagation(); run(command, args); })
    .child(svg(`mods/pane/${icon}.svg`).size(14));
  return h_flex().id(`adv-head-${pane}`).size_full().px(8).gap(8).items_center().text_size(12)
    .bg(speaking ? `${m.color}26` : t.background).border_b(1).border_color(speaking ? m.color : t.border)
    .on_hover((h, cx) => { view.hovered = h ? pane : null; cx.notify(); })
    .on_click(() => run("pane.focus", { pane }))
    .when(Boolean(m), (el) => el
      .child(div().size(22).flex_none().rounded_full().overflow_hidden().border(1).border_color(STATUS_COLOR[a.status] ?? m.color)
        .child(image(asset(m.head[a.status === "blocked" ? "ask" : a.status === "done" ? "happy" : "normal"])).size(20)))
      .child(div().flex_none().text_color(m.color).font_weight(700).child(m.name)))
    .child(div().flex_none().max_w(260).truncate().text_color(t.foreground).child(m ? `· ${name}` : name))
    .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(folder(p.cwd)))
    .when(speaking, (el) => el.child(div().flex_none().text_color(m.color).child("正在跟主人说话…")))
    .when(p.status === "blocked", (el) => el.child(div().flex_none().px(6).rounded(8).bg(STATUS_COLOR.blocked).text_color("#3a2a2e").child("等您吩咐")))
    .when(hovered, (el) => el
      .child(button(`ah-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
      .child(button(`ah-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
      .child(button(`ah-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
      .child(button(`ah-x-${pane}`, "close", "pane.close", { pane })));
}
