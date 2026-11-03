export const S = { agents: [], shared: {}, runs: [], hc: [] };
export const agents = () => S.agents;
export const panes = () => S.agents.map((a) => ({ pane: a.pane, terminal: "t-" + a.address }));
export const spaces = () => [{ id: "s1", tabs: [{ id: "t1", working_since: Date.now() - 120000 }] }];
export const shared = (k) => S.shared[k];
export const setShared = (k, v) => { S.shared[k] = v; };
export const run = (n, a) => { S.runs.push([n, a]); };
export const openOverlay = (o) => { S.runs.push(["overlay", o.props.part]); return "o1"; };
export const hc = async (args) => { S.hc.push(args); return { code: 0, stdout: "", stderr: "" }; };
