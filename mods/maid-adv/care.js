// 关心主人的作息：连续营业提醒休息、休息结束叫回、番茄钟到点
//   纯计时逻辑，不碰 herdr；导演每次渲染调用 tick()，用 nextAt() 预约下一次唤醒
const MIN = 60000;
export const WORK_MS = 90 * MIN;
export const BREAK_MS = 5 * MIN;
export const TOMATO_MS = 25 * MIN;

// 连续营业按 90 分钟一个窗口：窗口里有过聚焦或状态变化才提醒休息；没有就悄悄开始下一个窗口
//   （先结算窗口再记这次的动静，离开几个小时回来不会一进门就被催）
export class Care {
  constructor(now) {
    this.since = now;      // 这个窗口从什么时候开始
    this.acted = false;    // 这个窗口里有没有动静
    this.breakUntil = 0;   // 正在休息，到这个时间叫回
  }

  // activity：这次有聚焦或状态变化；tomato：番茄钟截止时间（没有为 0）
  // 返回到点的事件种类列表："rest" / "breakEnd" / "tomato"
  tick(now, activity, tomato = 0) {
    const due = [];
    if (this.breakUntil) {
      if (now >= this.breakUntil) {
        this.breakUntil = 0;
        this.reset(now);
        due.push("breakEnd");
      }
    } else if (now - this.since >= WORK_MS) {
      if (this.acted) due.push("rest");
      this.reset(now);
    }
    if (activity) this.acted = true;
    if (tomato && now >= tomato) due.push("tomato");
    return due;
  }

  reset(now) {
    this.since = now;
    this.acted = false;
  }

  takeBreak(now) {
    this.breakUntil = now + BREAK_MS;
  }

  nextAt(now, tomato = 0) {
    const at = Math.min(tomato || Infinity, this.breakUntil || this.since + WORK_MS);
    return Math.max(now, at);
  }
}

export const tomatoLeft = (until, now) => Math.max(0, Math.ceil((until - now) / MIN));
