// Maid Café ADV 布局的部件分发（props().part）：
//   top 顶栏章节 / stage 舞台立绘 / dialog 对话框（持有对话导演）/ chapters、log 浮层 / 窗格头部（props.pane）
import { View, div } from "gpui-kit";
import { InputState } from "gpui-base";
import { props, theme, nextCommand, run, shared, setShared, openOverlay } from "herdr";
import { Director } from "./engine.js";
import { top } from "./top.js";
import { stage } from "./stage.js";
import { dialog } from "./dialog.js";
import { paneHeader } from "./pane.js";
import { chapters, log, title, gallery, cgview, report, week } from "./overlays.js";

export default class MaidAdv extends View {
  init(_props, cx) {
    if (props()?.part === "dialog") {
      this.director = new Director();
      // 回复输入框：回车把文字发给正在说话那位的终端
      this.input = InputState.new({ placeholder: "直接回复她（回车发送给她的程序）…" });
      this.input.on("submit", (_e, cx) => {
        const line = this.replyLine;
        const text = this.input.value();
        if (!line || !text.trim()) return;
        cx.spawn(async (cx) => {
          const ok = await this.director.answer(line, text);
          if (ok) this.input.set_value("");
          cx.notify();
        });
      });
      // 截图检查用：demo.open 直接打开一个浮层
      const dopen = props()?.demo?.open;
      if (dopen) cx.timer.after(800, () => openOverlay({ mod: "maid-adv", kind: "dialog", width: dopen.w, height: dopen.h, ...(dopen.frame ? { frame: dopen.frame } : {}), props: { part: dopen.part, ...(dopen.props ?? {}) } }));
      // 每天第一次打开：标题画面
      const day = new Date().toDateString();
      if (shared("adv.titleDay") !== day) {
        setShared("adv.titleDay", day);
        cx.timer.after(600, () => openOverlay({ mod: "maid-adv", kind: "dialog", width: 960, height: 540, frame: "none", props: { part: "title" } }));
      }
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
    if (part === "top") return top(this, t, cx);
    if (part === "stage") return stage(this, t, cx);
    if (part === "dialog") return dialog(this, t, cx);
    if (part === "chapters") return chapters(this, t);
    if (part === "log") return log(this, t);
    if (part === "title") return title(this, t);
    if (part === "gallery") return gallery(this, t, cx);
    if (part === "cgview") return cgview(this, t);
    if (part === "report") return report(this, t);
    if (part === "week") return week(this, t);
    return div();
  }
}
