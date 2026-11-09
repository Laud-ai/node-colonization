// 0.17.1 pass / turn-order / develop-spread probe: npm run sim:passes -- [turns] [seeds]
// MODES env: comma list of rule patches by name (see PATCHES). Default "v0170".
import { mulberry32 } from "./rng.js";
import { applyRules } from "./rules.js";
import { createGame, runTurn, type PassDiag } from "./engine.js";
const turns = Number(process.argv[2] || 120);
const seeds = (process.argv[3] || "42,7,99,123,5").split(",").map(Number);
const PATCHES: Record<string, Record<string, boolean | number>> = {
  v0170: { aiTurnOrderRp: false, aiSpreadDevelop: false, aiActiveEarth: false },
  v0171: {},
};
const modes = (process.env.MODES || "v0170").split(",");
const verbose = process.env.VERBOSE === "1";
const lvlB = (l: number) => (l <= 1 ? "L1" : l <= 3 ? "L2-3" : l <= 6 ? "L4-6" : l <= 10 ? "L7-10" : "L11+");
const turnB = (t: number) => `T${Math.floor((t - 1) / 30) * 30 + 1}-${Math.floor((t - 1) / 30) * 30 + 30}`;
const inc = (o: Record<string, number>, k: string, n = 1) => { o[k] = (o[k] || 0) + n; };
function gini(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y); const n = a.length; const sum = a.reduce((s, x) => s + x, 0);
  if (!n || !sum) return 0;
  let acc = 0; a.forEach((x, i) => { acc += (2 * (i + 1) - n - 1) * x; });
  return acc / (n * sum);
}
for (const mode of modes) {
  const acts = { all: 0, pass: 0 };
  const byTurn: Record<string, [number, number]> = {}, byLvl: Record<string, [number, number]> = {}, byBloc: Record<string, [number, number]> = {};
  const reasons: Record<string, number> = {}, cycles: Record<string, number> = {};
  let coop = 0, allyFeed = 0, reqSwitch = 0;
  let orderPairs = 0, orderDesc = 0, firstIsTop = 0, turnsCounted = 0;
  const devByLvl: Record<string, number> = {};
  let devs = 0, giniSum = 0, topShareSum = 0, cyclesN = 0, unlocks = 0, revolts = 0, cols = 0;
  for (const seed of seeds) {
    const rng = mulberry32(seed);
    const G = createGame(seed, rng);
    applyRules(G, PATCHES[mode] ?? {});
    const at: { turn: number; id: string; rp: number; level: number; patron?: string }[] = [];
    const pt: PassDiag[] = [];
    const dt: { turn: number; id: string; level: number; patron: string }[] = [];
    Object.assign(G, { __actTrace: at, __passTrace: pt, __devTrace: dt });
    for (let t = 1; t <= turns; t++) runTurn(G, rng);
    const passKey = new Set(pt.map((p) => `${p.turn}|${p.id}`));
    const patronOf = new Map(G.colonies.map((c) => [c.id, c.patron]));
    for (const p of pt) patronOf.set(p.id, p.patron);
    for (const a of at) {
      const isPass = passKey.has(`${a.turn}|${a.id}`);
      acts.all++; if (isPass) acts.pass++;
      for (const [o, k] of [[byTurn, turnB(a.turn)], [byLvl, lvlB(a.level)], [byBloc, patronOf.get(a.id) || "?"]] as const) {
        const e = (o[k] ||= [0, 0]); e[0]++; if (isPass) e[1]++;
      }
    }
    for (const p of pt) {
      inc(reasons, p.reason); inc(cycles, p.cycle);
      if (p.coopBySwitch) coop++; if (p.allyFeed) allyFeed++; if (p.reqBySwitch) reqSwitch++;
    }
    // turn order: within each turn, adjacent actors' RP non-increasing?
    const byT = new Map<number, typeof at>();
    for (const a of at) (byT.get(a.turn) ?? byT.set(a.turn, []).get(a.turn)!).push(a);
    for (const list of byT.values()) {
      if (list.length < 2) continue;
      turnsCounted++;
      for (let i = 1; i < list.length; i++) { orderPairs++; if (list[i - 1]!.rp >= list[i]!.rp) orderDesc++; }
      if (list[0]!.rp >= Math.max(...list.map((x) => x.rp))) firstIsTop++;
    }
    devs += dt.length;
    for (const d of dt) inc(devByLvl, lvlB(d.level));
    const per = new Map<string, number>(); for (const d of dt) per.set(d.id, (per.get(d.id) || 0) + 1);
    const ids = new Set([...G.colonies.map((c) => c.id), ...per.keys()]);
    const counts = [...ids].map((id) => per.get(id) || 0);
    giniSum += gini(counts);
    topShareSum += dt.length ? Math.max(...counts) / dt.length : 0;
    cyclesN += G.log.filter((e) => /cycles Earth excess/.test(e.msg)).length;
    unlocks += G.log.filter((e) => /develops new free excess/.test(e.msg)).length;
    revolts += G.log.filter((e) => /⚑ REVOLUTION:/.test(e.msg)).length;
    cols += G.colonies.length;
  }
  const n = seeds.length, pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : "0") + "%";
  const fmt = (o: Record<string, [number, number]>) => Object.entries(o).sort().map(([k, [a, p]]) => `${k} ${pct(p, a)} (${p}/${a})`).join(" · ");
  console.log(`== ${mode} seeds ${seeds.join(",")} T${turns}`);
  console.log(`pass rate ${pct(acts.pass, acts.all)} (${acts.pass}/${acts.all} colony actions)`);
  console.log(`  by turn: ${fmt(byTurn)}`);
  console.log(`  by level: ${fmt(byLvl)}`);
  if (verbose) console.log(`  by bloc: ${fmt(byBloc)}`);
  console.log(`  reasons: ${Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  console.log(`  earth cycle at pass: ${Object.entries(cycles).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  console.log(`  possible-not-chosen at pass: coop Earth unlock by switching a non-vital route ${coop} · Requires by switching ${reqSwitch} · feed allied colony ${allyFeed}`);
  console.log(`turn order: ${pct(orderDesc, orderPairs)} adjacent pairs highest→lowest RP · first actor is top RP in ${pct(firstIsTop, turnsCounted)} of turns`);
  console.log(`develops ${devs} (${(devs / n).toFixed(1)}/seed) by level: ${Object.entries(devByLvl).sort().map(([k, v]) => `${k} ${v}`).join(" · ")} · Gini ${(giniSum / n).toFixed(2)} · top colony share ${(100 * topShareSum / n).toFixed(1)}%`);
  console.log(`  develops per colony action by level: ${Object.entries(byLvl).sort().map(([k, [a]]) => `${k} ${pct(devByLvl[k] || 0, a)}`).join(" · ")}`);
  console.log(`earth cycles ${(cyclesN / n).toFixed(1)}/seed · earth unlocks ${(unlocks / n).toFixed(1)}/seed · revolutions ${revolts} · colonies ${(cols / n).toFixed(1)}/seed`);
}
