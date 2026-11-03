// C 剧情：每位女仆都能播完 3 幕、在分支处选择，两个结局都走得到；好结局有 CG，坏结局没有
import assert from "node:assert/strict";
import { STORIES, StoryPlayer } from "./story.js";
import M from "./manifest.js";

const play = (s, pick) => {
  const p = new StoryPlayer(s);
  const seen = [];
  for (let guard = 0; guard < 100; guard++) {
    const st = p.step();
    seen.push(st.kind === "line" ? `${st.act}` : st.kind);
    if (st.kind === "end") return { p, seen, end: st };
    if (st.kind === "choice") { assert.equal(p.next(), false, "选项处不能直接点过去"); p.choose(pick); continue; }
    assert.ok(p.next());
  }
  throw new Error("没走到结局");
};

const crew = M.maids.filter((m) => !m.narrator).map((m) => m.id);
assert.deepEqual(Object.keys(STORIES).sort(), crew.sort(), "8 位女仆都有剧情");
for (const [mid, s] of Object.entries(STORIES)) {
  const gi = s.choices.findIndex((c) => c.good), bi = s.choices.findIndex((c) => !c.good);
  assert.ok(gi >= 0 && bi >= 0, `${mid} 有好坏两个选项`);
  const g = play(s, gi), b = play(s, bi);
  assert.equal(g.end.good, true); assert.equal(b.end.good, false);
  assert.ok(g.seen.includes("cg") && !b.seen.includes("cg"), `${mid} 只有好结局看 CG`);
  assert.deepEqual([...new Set(g.seen.filter((k) => /\d/.test(k)))], ["1", "2", "3"], `${mid} 3 幕`);
  assert.ok(M.cg[mid], `${mid} 有 CG`);
  for (const st of g.p.steps().concat(b.p.steps())) if (st.kind === "line" && st.mood !== "-") assert.ok(["normal", "happy", "ask", "pout"].includes(st.mood), `${mid} 表情 ${st.mood}`);
  assert.equal(g.p.next(), false, "完了就停");
  g.p.restart(); assert.equal(g.p.step().kind, "line"); assert.equal(g.p.good, null);
  console.log(`${mid}「${s.title}」 good: ${g.seen.join(" ")} | bad: ${b.seen.length} 步`);
}
console.log("OK");
