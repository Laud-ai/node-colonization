// 0.17.1 pass / turn-order / develop-spread probe: npm run sim:passes -- [turns] [seeds]
// MODES env: comma list of rule patches by name (see PATCHES). Default "v0170".
import { mulberry32 } from "./rng.js";
import { applyRules } from "./rules.js";
import { createGame, runTurn, type PassDiag } from "./engine.js";
import { thrustOf } from "./l5.js";
const turns = Number(process.argv[2] || 120);
const seeds = (process.argv[3] || "42,7,99,123,5").split(",").map(Number);
const OFF020 = { beltColonies: false, beltRichSpecialty: false, beltDepot: false, beltMilestone: false };
const OFF019 = { ...OFF020, relayLines: false, oxygenWars: false, nomadCamps: false, thinAirOxygen: false };
const OFF018 = { ...OFF019, bcNeutral: false, marsFoundingMoonAlly: false, marsMoonOnlyImports: false, aiLendAllies: false, aiLogisticsLoop: false };
const PATCHES: Record<string, Record<string, boolean | number>> = {
  v0170: { aiTurnOrderRp: false, aiSpreadDevelop: false, aiActiveEarth: false, ...OFF018 },
  v0171: { ...OFF018 },
  v0180: { ...OFF019 },
  v0190: { ...OFF020 },
  v0200: {},
  noDepot: { beltDepot: false }, noRich: { beltRichSpecialty: false }, reach2: { beltThrustReach: 2 },
  noRelay: { relayLines: false }, noO2War: { oxygenWars: false }, noNomad: { nomadCamps: false }, noThinAir: { thinAirOxygen: false },
  noLoop: { aiLogisticsLoop: false },
  noLend: { aiLendAllies: false },
  noMars: { marsFoundingMoonAlly: false, marsMoonOnlyImports: false },
  noBC: { bcNeutral: false },
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
  const marsActs = [0, 0]; let marsDevs = 0;
  let logiEarth = 0, logiCol = 0, moonMarsLends = 0, lends = 0, mars = 0, refugees = 0, o2 = 0;
  const firstMars: number[] = [];
  const x20 = { belt: 0, first: [] as number[], thrust: 0, milestones: 0, beltActs: 0, beltPass: 0, beltDevs: 0, beltCrises: 0, beltImports: 0 };
  const x19 = { relay: 0, relayMars: 0, crises: 0, pleaOk: 0, pleaNo: 0, justified: 0, seizeWon: 0, seizeLost: 0, hoarder: 0, acc: 0, armed: 0, refused: 0, camps: 0, raids: 0, repelled: 0, absorbed: 0, indep: 0 };
  let devs = 0, giniSum = 0, topShareSum = 0, cyclesN = 0, unlocks = 0, revolts = 0, cols = 0;
  for (const seed of seeds) {
    const rng = mulberry32(seed);
    const G = createGame(seed, rng);
    applyRules(G, PATCHES[mode] ?? {});
    const at: { turn: number; id: string; rp: number; level: number; patron?: string }[] = [];
    const pt: PassDiag[] = [];
    const dt: { turn: number; id: string; level: number; patron: string }[] = [];
    const lt: { turn: number; from: string; to: string }[] = [], gt: { kind: string }[] = [];
    Object.assign(G, { __actTrace: at, __passTrace: pt, __devTrace: dt, __lendTrace: lt, __logiTrace: gt });
    const crisisSeen = new Set<string>(), beltCrisis = new Set<string>();
    for (let t = 1; t <= turns; t++) {
      runTurn(G, rng);
      for (const c of G.colonies) if (c.oxygenCrisis) { crisisSeen.add(`${c.id}|${c.oxygenCrisis.since}`); if (c.body === "Belt") beltCrisis.add(`${c.id}|${c.oxygenCrisis.since}`); }
    }
    x19.crises += crisisSeen.size; x20.beltCrises += beltCrisis.size;
    x20.belt += G.colonies.filter((c) => c.body === "Belt").length;
    const fb = G.log.find((e) => /founded .* on the asteroid belt/.test(e.msg));
    x20.first.push(fb ? fb.turn : 999);
    x20.thrust += G.colonies.reduce((s, c) => s + thrustOf(c), 0);
    x20.milestones += G.log.filter((e) => /BELT MILESTONE/.test(e.msg)).length;
    x20.beltImports += G.colonies.filter((c) => c.body === "Belt").reduce((s, c) => s + c.logisticsLines.filter((l) => l.route).length, 0);
    const passKey = new Set(pt.map((p) => `${p.turn}|${p.id}`));
    const beltIds = new Set(G.colonies.filter((c) => c.body === "Belt").map((c) => c.id));
    for (const a of at) if (beltIds.has(a.id)) { x20.beltActs++; if (passKey.has(`${a.turn}|${a.id}`)) x20.beltPass++; }
    x20.beltDevs += dt.filter((d) => beltIds.has(d.id)).length;
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
    const bodyOf = new Map(G.colonies.map((c) => [c.id, c.body]));
    for (const a of at) if (bodyOf.get(a.id) === "Mars") { marsActs[0]++; if (passKey.has(`${a.turn}|${a.id}`)) marsActs[1]++; }
    marsDevs += dt.filter((d) => bodyOf.get(d.id) === "Mars").length;
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
    lends += lt.length; moonMarsLends += lt.filter((x) => x.from === "Moon" && x.to === "Mars").length;
    logiEarth += gt.filter((x) => x.kind === "earth").length; logiCol += gt.filter((x) => x.kind !== "earth").length;
    mars += G.colonies.filter((c) => c.body === "Mars").length;
    const fm = G.log.find((e) => /found.*on Mars|Mars.*found/i.test(e.msg) && !/cannot|blocked/i.test(e.msg));
    const fmc = Math.min(...G.colonies.filter((c) => c.body === "Mars").map((c) => c.foundedTurn ?? 999), fm?.turn ?? 999);
    firstMars.push(fmc);
    const cnt = (re: RegExp) => G.log.filter((e) => re.test(e.msg)).length;
    x19.relay += cnt(/^🔁 .* relays Earth/); x19.relayMars += G.log.filter((e) => /^🔁 .* relays Earth/.test(e.msg) && G.colonies.some((c) => c.body === "Mars" && e.msg.endsWith(` to ${c.name}.`))).length;
    x19.pleaOk += cnt(/🫁 PLEA ACCEPTED/); x19.pleaNo += cnt(/🫁 PLEA REFUSED/); x19.justified += cnt(/⚖ Justified war/);
    x19.seizeWon += cnt(/⚔ SEIZED:/); x19.seizeLost += cnt(/SEIZE FAILED/); x19.hoarder += cnt(/🏴 HOARDER:/);
    x19.acc += cnt(/REFUGEES ACCEPTED/); x19.armed += cnt(/REFUGEES ARMED/); x19.refused += cnt(/REFUGEES REFUSED/);
    x19.camps += cnt(/⛺ NOMAD CAMP:/); x19.raids += cnt(/⛺ RAID:/); x19.repelled += cnt(/RAID REPELLED/); x19.absorbed += cnt(/is broken up and absorbed/); x19.indep += cnt(/⛺→⚑/);
    refugees += G.log.filter((e) => /🏕 Refugees flee/.test(e.msg)).length;
    for (const e of G.log) { const m = /☠ (\d+) Population died/.exec(e.msg); if (m) o2 += Number(m[1]); }
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
  console.log(`Logistics imports ${(logiEarth / n).toFixed(1)} Earth + ${(logiCol / n).toFixed(1)} colony /seed · lends ${(lends / n).toFixed(1)}/seed (Moon→Mars ${(moonMarsLends / n).toFixed(1)}) · Mars colonies at end ${(mars / n).toFixed(1)}/seed · first Mars founding T ${firstMars.map((t) => (t >= 999 ? "never" : t)).join(",")} · Mars pass rate ${pct(marsActs[1], marsActs[0])} · Mars develops ${(marsDevs / n).toFixed(1)}/seed · refugee waves ${refugees} · O₂ deaths ${o2}`);
  console.log(`0.19: relays ${x19.relay} (to Mars ${x19.relayMars}) · O₂ crises ${x19.crises} · pleas accepted ${x19.pleaOk} / refused ${x19.pleaNo} · justified wars ${x19.justified} · seizures won ${x19.seizeWon} / lost ${x19.seizeLost} · hoarder marks ${x19.hoarder} · refugees accepted ${x19.acc} / armed ${x19.armed} / all-refused ${x19.refused} · camps ${x19.camps} (raids ${x19.raids}, repelled ${x19.repelled}, absorbed ${x19.absorbed}, → Independent ${x19.indep})`);
  console.log(`0.20: belt colonies ${(x20.belt / n).toFixed(1)}/seed · first belt founding T ${x20.first.map((t) => (t >= 999 ? "never" : t)).join(",")} · Thrust total at end ${(x20.thrust / n).toFixed(1)}/seed · belt pass rate ${pct(x20.beltPass, x20.beltActs)} · belt develops ${(x20.beltDevs / n).toFixed(1)}/seed · belt active imports at end ${x20.beltImports} · belt O₂ crises ${x20.beltCrises} · milestones ${x20.milestones}`);
  console.log(`earth cycles ${(cyclesN / n).toFixed(1)}/seed · earth unlocks ${(unlocks / n).toFixed(1)}/seed · revolutions ${revolts} · colonies ${(cols / n).toFixed(1)}/seed`);
}
