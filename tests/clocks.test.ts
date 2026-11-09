// 0.16.0 survival clocks (Tiago): each clock is keyed to its own resource and ticks only while the
// colony has its own Population (developed or specialty) and lacks that resource. Strain alone never ticks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/engine.js";
import { mulberry32 } from "../src/rng.js";
import { applyRules } from "../src/rules.js";
import { NODES, strainOf } from "../src/nodes.js";
import { tickSurvivalClocks, hasNativePopulation, TF_LIVABLE, stabilityBacked, clockTrips, oxygenSuppliersNotTrading } from "../src/l4.js";
import type { Colony, GameState, NodeType } from "../src/types.js";

function setup(rules: Record<string, number | boolean> | null = { survivalScaledCover: false }): { G: GameState; c: Colony } {
  const G = createGame(7);
  if (rules) applyRules(G, rules);
  const c = G.colonies[0]!;
  for (const n of NODES) c.developed[n] = 0;
  c.logisticsLines.forEach((l) => { l.route = null; l.exportRoute = null; });
  c.specialty = "Science"; c.requires = "Money";
  c.foodClock = 0; c.waterClock = 0; c.oxygenClock = 0; c.populationStress = 0;
  c.lastRefugeeTurn = -999;
  G.bodyTF[c.body] = 0;
  G.turn = 101; // odd turn (Health rule irrelevant: no Stability)
  return { G, c };
}
function importNode(c: Colony, n: NodeType, from?: Colony): void {
  let line = c.logisticsLines.find((l) => !l.route);
  if (!line) { line = { ...c.logisticsLines[0]!, id: `t${c.logisticsLines.length}`, route: null, exportRoute: null }; c.logisticsLines.push(line); }
  line.route = { node: n, sourceKind: from ? "colony" : "earth", sourceId: from?.id ?? "earth", sourceName: from?.name ?? "Earth" } as unknown as NonNullable<typeof line.route>;
}
const tick = (G: GameState, c: Colony, times = 1) => { for (let i = 0; i < times; i++) { tickSurvivalClocks(G, c, mulberry32(1)); G.turn += 2; } };
const clocks = (c: Colony) => [c.foodClock || 0, c.waterClock || 0, c.oxygenClock || 0];

test("0.16.0 strain without any Population never ticks a clock", () => {
  const { G, c } = setup();
  c.developed.Science = 1; c.developed.Money = 1; // unmet deps → strain
  assert.ok(strainOf(c) > 0, "test colony is strained");
  tick(G, c, 3);
  assert.deepEqual(clocks(c), [0, 0, 0]);
});

test("0.16.0 developed Population lacking only Food ticks only the Food clock", () => {
  const { G, c } = setup();
  c.developed.Population = 1; c.developed.Water = 1; c.developed.Oxygen = 1;
  tick(G, c, 2);
  assert.deepEqual(clocks(c), [2, 0, 0]);
});

test("0.16.0 each clock is keyed to its own resource (Water, Oxygen)", () => {
  const { G, c } = setup();
  c.developed.Population = 1; c.developed.Food = 1; c.developed.Oxygen = 1;
  tick(G, c);
  assert.deepEqual(clocks(c), [0, 1, 0]);
  const s2 = setup(); s2.c.developed.Population = 1; s2.c.developed.Food = 1; s2.c.developed.Water = 1;
  tick(s2.G, s2.c);
  assert.deepEqual(clocks(s2.c), [0, 0, 1]);
});

test("0.16.0 the gate is Population + missing resource, not the strain level", () => {
  const { G, c } = setup();
  c.developed.Population = 1; c.developed.Water = 1; c.developed.Oxygen = 1; c.developed.Food = 0;
  tick(G, c);
  assert.equal(c.foodClock, 1);
});

test("0.16.0 imported-only Population needs nothing: no clocks", () => {
  const { G, c } = setup();
  importNode(c, "Population");
  assert.ok(!hasNativePopulation(c));
  tick(G, c, 3);
  assert.deepEqual(clocks(c), [0, 0, 0]);
});

test("0.16.0 specialty Population counts as the colony's own Population", () => {
  const { G, c } = setup();
  c.specialty = "Population";
  c.developed.Water = 1; c.developed.Oxygen = 1;
  tick(G, c);
  assert.deepEqual(clocks(c), [1, 0, 0]);
});

test("0.16.0 an imported resource covers the need (no tick)", () => {
  const { G, c } = setup();
  c.developed.Population = 1; c.developed.Water = 1; c.developed.Oxygen = 1;
  importNode(c, "Food");
  tick(G, c, 3);
  assert.deepEqual(clocks(c), [0, 0, 0]);
});

test("0.16.0 Oxygen never ticks on a livable body", () => {
  const { G, c } = setup();
  c.developed.Population = 1; c.developed.Food = 1; c.developed.Water = 1;
  G.bodyTF[c.body] = TF_LIVABLE;
  tick(G, c, 3);
  assert.deepEqual(clocks(c), [0, 0, 0]);
});

test("0.16.0 clocks decay 1/turn once the resource is restored or the native Population is gone", () => {
  const { G, c } = setup();
  c.developed.Population = 1; c.developed.Water = 1; c.developed.Oxygen = 1;
  tick(G, c, 3);
  assert.equal(c.foodClock, 3);
  c.developed.Food = 1;
  tick(G, c);
  assert.equal(c.foodClock, 2);
  c.developed.Food = 0; c.developed.Population = 0;
  tick(G, c);
  assert.equal(c.foodClock, 1, "no native Population → decays, never advances");
});

test("0.16.0 a tripped clock sends refugees from the native Population and resets", () => {
  const { G, c } = setup();
  c.developed.Population = 1; c.developed.Water = 1; c.developed.Oxygen = 1;
  tick(G, c, 6); // default trip 6
  assert.equal(c.foodClock, 0);
  assert.equal(c.developed.Population, 0, "refugees took the developed Population");
  tick(G, c, 3);
  assert.deepEqual(clocks(c), [0, 0, 0], "no Population left → no more clocks");
});

test("0.16.0 rule off (0.9.4–0.15.x) keeps the old strain-gated behaviour", () => {
  const { G, c } = setup({ survivalNeedsPopulation: false, survivalScaledCover: false });
  c.developed.Science = 1; c.developed.Money = 1;
  assert.ok(strainOf(c) > 0);
  tick(G, c);
  assert.deepEqual(clocks(c), [1, 1, 1], "old rule: strain + lacking ticks every clock, no Population needed");
  const s2 = setup(null); // no G.rules = pre-0.9.4 legacy
  s2.c.developed.Science = 1; s2.c.developed.Money = 1;
  tick(s2.G, s2.c);
  assert.deepEqual(clocks(s2.c), [1, 1, 1]);
});

// ── 0.17.0 (Tiago): scaled cover, free specialty Population, Stability backing, 3/2/1 clocks, O₂ deaths ──
const V17 = {};
const own = (c: Colony, pop: number, food: number, water: number, oxygen: number) => {
  c.developed.Population = pop; c.developed.Food = food; c.developed.Water = water; c.developed.Oxygen = oxygen;
};
const refugeeLogs = (G: GameState) => G.log.filter((e) => /🏕 Refugees flee/.test(e.msg)).length;

test("0.17.0 N Population needs N of each: a shortfall ticks only that resource's clock", () => {
  const { G, c } = setup(V17);
  own(c, 2, 2, 1, 2);
  tick(G, c);
  assert.deepEqual(clocks(c), [0, 1, 0]);
  own(c, 3, 3, 3, 3);
  tick(G, c);
  assert.deepEqual(clocks(c), [0, 0, 0], "covered → wind-down");
});

test("0.17.0 imports count toward cover", () => {
  const { G, c } = setup(V17);
  own(c, 2, 2, 1, 2);
  importNode(c, "Water");
  tick(G, c, 3);
  assert.deepEqual(clocks(c), [0, 0, 0]);
});

test("0.17.0 Population specialty = one free Population that needs no cover", () => {
  const { G, c } = setup(V17);
  c.specialty = "Population";
  tick(G, c, 3);
  assert.deepEqual(clocks(c), [0, 0, 0], "specialty alone needs nothing");
  own(c, 1, 1, 1, 1);
  tick(G, c, 3);
  assert.deepEqual(clocks(c), [0, 0, 0], "1 developed + free specialty → 1 of each suffices");
});

test("0.17.0 imported Population needs nothing", () => {
  const { G, c } = setup(V17);
  importNode(c, "Population");
  tick(G, c, 3);
  assert.deepEqual(clocks(c), [0, 0, 0]);
});

test("0.17.0 Oxygen never ticks once the body is livable", () => {
  const { G, c } = setup(V17);
  own(c, 2, 2, 2, 0);
  G.bodyTF[c.body] = TF_LIVABLE;
  tick(G, c, 3);
  assert.deepEqual(clocks(c), [0, 0, 0]);
});

test("0.17.0 Stability halves ticks only if ≥ half its prerequisites are owned or imported", () => {
  const { G, c } = setup(V17);
  own(c, 1, 0, 1, 1); c.developed.Stability = 1;
  c.developed.Culture = 1; // 1 + Water = 2 of 5 → not backed
  assert.ok(!stabilityBacked(c));
  G.turn = 100; tickSurvivalClocks(G, c, mulberry32(1));
  assert.equal(c.foodClock, 1, "unbacked Stability: even turn still ticks");
  importNode(c, "Ideology"); // 3 of 5 (Culture, Water owned; Ideology imported)
  assert.ok(stabilityBacked(c));
  G.turn = 102; tickSurvivalClocks(G, c, mulberry32(1));
  assert.equal(c.foodClock, 1, "backed Stability: even turn skipped");
  G.turn = 103; tickSurvivalClocks(G, c, mulberry32(1));
  assert.equal(c.foodClock, 2, "odd turn ticks");
});

test("0.17.0 clock lengths: Food 3, Water 2, Oxygen 1 turns of grace, then fire", () => {
  const { G } = setup(V17);
  assert.deepEqual(clockTrips(G), { food: 3, water: 2, oxygen: 1 });
  const f = setup(V17); own(f.c, 2, 0, 2, 2);
  tick(f.G, f.c, 3); assert.equal(f.c.foodClock, 3); assert.equal(f.c.developed.Population, 2);
  tick(f.G, f.c); assert.equal(f.c.foodClock, 0); assert.equal(f.c.developed.Population, 1, "4th short tick → refugees");
  assert.equal(refugeeLogs(f.G), 1);
  const w = setup(V17); own(w.c, 2, 2, 0, 2);
  tick(w.G, w.c, 2); assert.equal(w.c.waterClock, 2);
  tick(w.G, w.c); assert.equal(w.c.developed.Population, 1, "3rd short tick → refugees");
});

test("0.17.0 no per-colony refugee cooldown: a second Food wave comes after another 3+1 ticks", () => {
  const { G, c } = setup(V17); own(c, 3, 0, 3, 3);
  tick(G, c, 8);
  assert.equal(refugeeLogs(G), 2);
  assert.equal(c.developed.Population, 1);
});

test("0.17.0 Oxygen fires → the uncovered Population dies (no refugees)", () => {
  const { G, c } = setup(V17); own(c, 3, 3, 3, 1);
  tick(G, c);
  assert.equal(c.oxygenClock, 1);
  assert.ok(c.oxygenCrisis, "crisis while the O₂ clock runs");
  tick(G, c);
  assert.equal(c.developed.Population, 1, "shortfall 2 → 2 die");
  assert.equal(c.oxygenClock, 0);
  assert.equal(refugeeLogs(G), 0, "nobody migrates");
  assert.ok(G.log.some((e) => /☠ 2 Population died/.test(e.msg)));
  assert.equal(c.oxygenCrisis ?? null, null, "crisis cleared once covered");
});

test("0.17.0 wind-down: a covered clock drops 1 per tick", () => {
  const { G, c } = setup(V17); own(c, 1, 0, 1, 1);
  tick(G, c, 2); assert.equal(c.foodClock, 2);
  c.developed.Food = 1;
  tick(G, c); assert.equal(c.foodClock, 1);
});

test("0.17.0 oxygen crisis hook lists colonies with spare O₂ that are not sending any", () => {
  const { G, c } = setup(V17); own(c, 2, 2, 2, 0);
  const o = G.colonies.find((x) => x.id !== c.id)!;
  for (const n of NODES) o.developed[n] = 0;
  o.logisticsLines.forEach((l) => { l.route = null; l.exportRoute = null; });
  o.specialty = "Science"; o.developed.Oxygen = 3; G.bodyTF[o.body] = 0;
  tick(G, c);
  const ids = c.oxygenCrisis!.suppliers.map((s) => s.id);
  assert.ok(ids.includes(o.id), "spare-O₂ colony listed");
  assert.equal(c.oxygenCrisis!.suppliers.find((s) => s.id === o.id)!.surplus, 3);
  importNode(c, "Oxygen", o); // o now sends 1 — still short 1
  assert.ok(!oxygenSuppliersNotTrading(G, c).some((s) => s.id === o.id), "a sending colony is not 'refusing'");
});
