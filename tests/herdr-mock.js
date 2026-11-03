export const S = { agents: [], shared: {}, runs: [], hc: [], exec: [], screen: {}, claude: null };
export const agents = () => S.agents;
export const panes = () => S.agents.map((a) => ({ pane: a.pane, terminal: "t-" + a.address }));
export const spaces = () => [{ id: "s1", tabs: [{ id: "t1", working_since: Date.now() - 120000 }] }];
export const shared = (k) => S.shared[k];
export const setShared = (k, v) => { S.shared[k] = v; };
export const run = (n, a) => { S.runs.push([n, a]); };
export const openOverlay = (o) => { S.runs.push(["overlay", o.props.part]); return "o1"; };
// hc read 返回 S.screen[终端]；其余命令只记录
export const hc = async (args) => {
  S.hc.push(args);
  if (args[0] === "read") return { code: 0, stdout: JSON.stringify({ text: S.screen[args[1]] ?? "" }), stderr: "" };
  return { code: 0, stdout: "", stderr: "" };
};
// claude -p：S.claude 为字符串时返回它，为 null 时模拟失败
export const exec = async (cmd, args) => {
  S.exec.push([cmd, ...args]);
  if (S.claude == null) return { code: 1, stdout: "", stderr: "timeout" };
  return { code: 0, stdout: S.claude, stderr: "" };
};
