// Maid Café ADV 布局的部件分发（props().part）：
//   top 顶栏章节 / stage 舞台立绘 / dialog 对话框（持有对话导演）/ chapters、log 浮层 / 窗格头部（props.pane）
import { View, div } from "gpui-kit";
import { props, theme, nextCommand, run } from "herdr";
import { Director } from "./engine.js";
import { top } from "./top.js";
import { stage } from "./stage.js";
import { dialog } from "./dialog.js";
import { paneHeader } from "./pane.js";
import { chapters, log } from "./overlays.js";

export default class MaidAdv extends View {
  init(_props, cx) {
    if (props()?.part === "dialog") {
      this.director = new Director();
      // 只有对话框这一份接快捷键命令（cmd-b → 舞台开关）
      cx.spawn(async (cx) => {
        for (;;) {
          const c = await nextCommand();
          if (c.endsWith("toggle")) run("layout.toggle", { id: "stage" });
          cx.notify();
        }
      });
    }
  }

  render(cx) {
    const t = theme();
    if (props()?.pane) return paneHeader(this, t);
    const part = props()?.part;
    if (part === "top") return top(this, t);
    if (part === "stage") return stage(this, t, cx);
    if (part === "dialog") return dialog(this, t, cx);
    if (part === "chapters") return chapters(this, t);
    if (part === "log") return log(this, t);
    return div();
  }
}
