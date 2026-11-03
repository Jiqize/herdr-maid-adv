// 顶栏：章节徽章「第 N 话」+ space 名（点开章节选择）、◀ ▶ 切换 space、tab 书签、+、Files / Changes / 舞台开关
import { div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, panes, agents, run, openOverlay, shared, setShared, layout, props } from "herdr";
import { asset, assign, maidOf, find, STATUS_COLOR } from "./state.js";
import { tomatoLeft } from "./care.js";

const stop = (_e, cx) => cx.stop_propagation();

function tabName(c, ps) {
  if (!/^(tb)?\d+$/.test(c.name)) return c.name;
  const program = ps.find((p) => p.tab === c.id && p.program?.agent)?.program ?? ps.find((p) => p.tab === c.id)?.program;
  return program?.name ?? "Terminal";
}

// 番茄钟剩余分钟：整分钟刷新一次（一次性 timer，同时只挂一个）
function tomatoPill(view, t, cx) {
  const until = props()?.demo?.tomato ?? shared("adv.tomato") ?? 0;
  const now = Date.now();
  if (until <= now) return null;
  if (!view.tomT && !props()?.demo) {
    view.tomT = true;
    cx.timer.after(((until - now) % 60000) + 50, (cx) => { view.tomT = false; cx.notify(); });
  }
  return h_flex().id("adv-tomato").h(26).px(10).gap(4).flex_none().items_center().rounded(13)
    .bg("#ff6b5a1f").border(1).border_color("#ff6b5a88").cursor_pointer()
    .text_size(12).text_color(t.foreground).tooltip("番茄钟（点击取消）")
    .on_mouse_down("left", stop).on_click(() => setShared("adv.tomato", null))
    .child("🍅").child(`${tomatoLeft(until, now)} 分`);
}

export function top(view, t, cx) {
  const list = spaces();
  const i = list.findIndex((s) => s.active);
  const space = list[i];
  const tabs = space?.tabs ?? [];
  const ps = panes();
  const ags = agents();
  const mids = assign(ags);

  const arrow = (id, icon, cmd, tip) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(13)
    .cursor_pointer().text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
    .tooltip(tip).on_mouse_down("left", stop).on_click(() => run(cmd))
    .child(svg(`mods/workspace-chrome/${icon}.svg`).size(14));

  const chapter = h_flex().id("adv-chapter").h(32).pl(4).pr(12).gap(8).items_center().rounded(16)
    .bg(t.surface).border(2).border_color(t.accent).cursor_pointer().tooltip("章节选择（全部 space）")
    .on_mouse_down("left", stop)
    .on_click(() => openOverlay({ mod: "maid-adv", kind: "popup", width: 320, height: 460, props: { part: "chapters" } }))
    .child(div().h(24).px(8).flex().items_center().rounded(12).bg(t.accent).text_size(12).font_weight(700).text_color(t.accent_foreground)
      .child(`第 ${i + 1} 话`))
    .child(div().max_w(220).truncate().text_size(13).text_color(t.foreground).child(space?.name ?? ""));

  // tab 书签：左侧一条女仆色，前面是她的小头像
  const tab = (c, k) => {
    const a = ags.find((x) => x.tab === c.id);
    const m = a ? maidOf(mids.get(a.address)) : null;
    const color = m?.color ?? t.border;
    return h_flex().id(`adv-tab-${c.id}`).h(30).pl(0).pr(10).gap(6).flex_none().items_center().rounded_r(8).overflow_hidden()
      .cursor_pointer().text_size(12)
      .when(c.active, (el) => el.bg(t.surface).text_color(t.foreground).border(1).border_color(color))
      .when(!c.active, (el) => el.text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); view.pressed = k; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
      .on_mouse_up("left", () => {
        const from = view.pressed; view.pressed = null;
        if (from != null && from !== k) run("tab.move", { id: tabs[from].id, index: k + 1 });
        else run("tab.select", { id: c.id });
      })
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } });
      })
      .child(div().w(4).h_full().bg(color))
      .when(Boolean(m), (el) => el.child(div().size(22).rounded_full().overflow_hidden().border(1).border_color(STATUS_COLOR[a.status] ?? color)
        .child(image(asset(m.head[a.status === "blocked" ? "ask" : a.status === "done" ? "happy" : "normal"])).size(20))))
      .child(div().max_w(150).truncate().child(c.zoomed ? `${tabName(c, ps)} Z` : tabName(c, ps)))
      .when(c.status === "blocked", (el) => el.child(div().size(6).rounded_full().bg(STATUS_COLOR.blocked)));
  };

  const iconButton = (id, icon, tip, on, action) => div().id(id).size(30).flex_none().flex().items_center().justify_center().rounded(8)
    .cursor_pointer().text_color(on ? t.accent : t.muted).when(on, (el) => el.bg(t.selected))
    .hover((s) => s.bg(t.hover).text_color(t.foreground))
    .tooltip(tip).on_mouse_down("left", stop).on_click(action)
    .child(svg(icon).size(16));

  const pill = tomatoPill(view, t, cx);
  const root = layout();
  const panel = find(root, "panel");
  const body = find(root, "panel-body");
  const stageNode = find(root, "stage");
  const enabled = shared("workspace.panels") ?? ["files", "changes"];
  const panelButton = (id, icon, tip) => {
    const on = Boolean(panel && !panel.hidden && body?.active === id);
    return iconButton(`adv-panel-${id}`, icon, tip, on, () => {
      if (on) run("layout.hide", { id: "panel" });
      else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
    });
  };

  return h_flex().size_full().bg(t.canvas).pl(84).pr(12).gap(6).items_center()
    .on_mouse_up("left", () => { view.pressed = null; })
    .on_scroll_wheel((e) => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
    .child(arrow("adv-prev", "chevron-left", "space.prev", "上一话"))
    .child(chapter)
    .child(arrow("adv-nextch", "chevron-right", "space.next", "下一话"))
    .child(div().w(10))
    .child(h_flex().id("adv-tabs").flex_1().min_w(0).gap(4).items_center().overflow_x_scrollbar().children(tabs.map(tab))
      .child(iconButton("adv-tab-new", "mods/workspace-chrome/plus.svg", "新建 tab", false,
        () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 }))))
    .when(Boolean(pill), (el) => el.child(pill))
    .when(enabled.includes("files"), (el) => el.child(panelButton("files", "mods/files/file.svg", "Files")))
    .when(enabled.includes("changes"), (el) => el.child(panelButton("changes", "mods/changes/changes.svg", "Changes")))
    .child(iconButton("adv-stage", "mods/workspace-chrome/panel-right.svg", "舞台（⌘B）", Boolean(stageNode && !stageNode.hidden),
      () => run("layout.toggle", { id: "stage" })));
}
