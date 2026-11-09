// 0.16.0 survival clocks (Tiago): each clock is keyed to its own resource and ticks only while the
// colony has its own Population (developed or specialty) and lacks that resource. Strain alone never ticks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/engine.js";
import { mulberry32 } from "../src/rng.js";
import { applyRules } from "../src/rules.js";
import { NODES, strainOf } from "../src/nodes.js";
import { tickSurvivalClocks, hasNativePopulation, TF_LIVABLE } from "../src/l4.js";
import type { Colony, GameState, NodeType } from "../src/types.js";

function setup(rules: Record<string, number | boolean> | null = {}): { G: GameState; c: Colony } {
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
function importNode(c: Colony, n: NodeType): void {
  const line = c.logisticsLines.find((l) => !l.route)!;
  assert.ok(line, "free logistics line");
  line.route = { node: n } as unknown as NonNullable<typeof line.route>;
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
  const { G, c } = setup({ survivalNeedsPopulation: false });
  c.developed.Science = 1; c.developed.Money = 1;
  assert.ok(strainOf(c) > 0);
  tick(G, c);
  assert.deepEqual(clocks(c), [1, 1, 1], "old rule: strain + lacking ticks every clock, no Population needed");
  const s2 = setup(null); // no G.rules = pre-0.9.4 legacy
  s2.c.developed.Science = 1; s2.c.developed.Money = 1;
  tick(s2.G, s2.c);
  assert.deepEqual(clocks(s2.c), [1, 1, 1]);
});
