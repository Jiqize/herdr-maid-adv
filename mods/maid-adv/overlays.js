// 两个浮层：章节选择（全部 space）、LOG（最近 60 句台词）
import { div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, agents, run, props, closeOverlay } from "herdr";
import { asset, assign, maidOf, readLog, STATUS_COLOR, STATUS_TEXT } from "./state.js";

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
