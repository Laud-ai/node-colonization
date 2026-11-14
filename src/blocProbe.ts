// 0.21.0 per-bloc colonization probe: MODES=v0200,v0210 npm run sim:blocs -- [turns] [seeds]
// First-colony turn per bloc (first turn the bloc holds a colony), colonies per bloc at end, blocs that never colonize,
// total colonies, belt colonies, wave/daughter foundings (0.21 event log).
import { mulberry32 } from "./rng.js";
import { applyRules } from "./rules.js";
import { createGame, runTurn } from "./engine.js";
const turns = Number(process.argv[2] || 120);
const seeds = (process.argv[3] || "42,7,99,123,5").split(",").map(Number);
const OFF021 = { colonizationWaves: false, firstFoundingWave: false, daughterColonies: false, eventLog: false };
const PATCHES: Record<string, Record<string, boolean | number>> = {
  v0200: { ...OFF021 }, v0210: {},
  noPressure: { colonizationWaves: false }, noWave: { firstFoundingWave: false }, noDaughter: { daughterColonies: false },
};
const modes = (process.env.MODES || "v0200,v0210").split(",");
for (const mode of modes) {
  const first: Record<string, number[]> = {}, count: Record<string, number[]> = {}, founded: Record<string, number[]> = {};
  let total = 0, belt = 0, never = 0, wave = 0, daughter = 0, pressure = 0, events = 0;
  const neverBy: Record<string, number> = {};
  for (const seed of seeds) {
    const rng = mulberry32(seed);
    const G = createGame(seed, rng);
    applyRules(G, PATCHES[mode] ?? {});
    const seen: Record<string, number> = {}, origin = new Map<string, { p: string; t: number }>();
    for (const c of G.colonies) origin.set(c.id, { p: c.patron, t: 1 });
    for (let t = 1; t <= turns; t++) {
      runTurn(G, rng);
      // founding bloc = patron when first seen (end of its founding turn)
      for (const c of G.colonies) if (!origin.has(c.id)) origin.set(c.id, { p: c.patron, t: c.foundedTurn ?? t });
    }
    const count0: Record<string, number> = {};
    for (const { p, t } of origin.values()) {
      if (p === "Independent") continue;
      count0[p] = (count0[p] || 0) + 1;
      if (!(p in seen) || t < seen[p]!) seen[p] = t;
    }
    for (const b of G.blocs) {
      (first[b.name] ||= []).push(seen[b.name] ?? 999);
      (count[b.name] ||= []).push(G.colonies.filter((c) => c.patron === b.name).length);
      (founded[b.name] ||= []).push(count0[b.name] ?? 0);
      if (!(b.name in seen)) { never++; neverBy[b.name] = (neverBy[b.name] || 0) + 1; }
    }
    total += G.colonies.length; belt += G.colonies.filter((c) => c.body === "Belt").length;
    const ev = G.events ?? [];
    events += ev.length;
    wave += ev.filter((e) => e.type === "found" && e.tags?.includes("wave")).length;
    daughter += ev.filter((e) => e.type === "found" && e.tags?.includes("daughter")).length;
    pressure += ev.filter((e) => e.type === "found" && e.tags?.includes("pressure")).length;
  }
  const n = seeds.length;
  console.log(`== ${mode} seeds ${seeds.join(",")} T${turns}`);
  console.log(`| bloc | first colony turn (per seed) | colonies founded (avg) | held at end (avg) |`);
  for (const b of Object.keys(first)) {
    const f = first[b]!.map((x) => (x === 999 ? "—" : String(x))).join(", ");
    const avg = count[b]!.reduce((s, x) => s + x, 0) / n;
    const fa = founded[b]!.reduce((s, x) => s + x, 0) / n;
    console.log(`| ${b} | ${f} | ${fa.toFixed(1)} | ${avg.toFixed(1)} |`);
  }
  console.log(`total colonies ${(total / n).toFixed(1)}/seed · belt ${(belt / n).toFixed(1)}/seed · bloc-seeds never colonizing ${never}/${n * Object.keys(first).length}${never ? " (" + Object.entries(neverBy).map(([k, v]) => `${k} ${v}`).join(", ") + ")" : ""} · foundings tagged pressure ${pressure} / wave ${wave} / daughter ${daughter} · events ${(events / n).toFixed(0)}/seed`);
}
