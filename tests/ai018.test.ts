// 0.18.0 (Tiago): BC Neutral, Mars via friendly Moon colony only, Mars imports only from Moon,
// ally lending / no hoarding, Logistics loop (Earth Logistics → cycle → fill friendly blocs).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame, makeColony, startTurn, findSources, pickBestLender, autoAct, socialAffinity, blocByName,
} from "../src/engine.js";
import { canFoundMars } from "../src/nation.js";
import { hasThrustReach } from "../src/l5.js";
import { mulberry32 } from "../src/rng.js";
import { applyRules } from "../src/rules.js";
import { NODES } from "../src/nodes.js";
import type { Body, Colony, GameState, NodeType } from "../src/types.js";

function world(rules: Record<string, boolean | number> | null = {}): GameState {
  const G = createGame(7);
  if (rules) applyRules(G, rules);
  G.colonies = [];
  for (const b of G.blocs) b.excess = [];
  return G;
}
function col(G: GameState, name: string, opts: { requires?: NodeType; devs?: Partial<Record<NodeType, number>>; patron?: string; body?: Body; specialty?: NodeType } = {}): Colony {
  const c = makeColony(G, { patron: opts.patron ?? "United States", body: opts.body ?? "Moon", specialty: opts.specialty ?? "Science",
    requires: opts.requires ?? "Money", culture: ["American"], ideology: ["Liberal"], name });
  for (const n of NODES) c.developed[n] = opts.devs?.[n] ?? 0;
  G.colonies.push(c);
  return c;
}
const bloc = (G: GameState, n: string) => blocByName(G, n)!;

test("0.18.0 British Commonwealth starts Neutral (rule on), West without rules", () => {
  const G = createGame(7); applyRules(G); startTurn(G, mulberry32(7));
  assert.equal(bloc(G, "British Commonwealth").alliance, "Neutral");
  const L = createGame(7); startTurn(L, mulberry32(7));
  assert.equal(bloc(L, "British Commonwealth").alliance, "West");
});

test("0.18.0 Mars founding needs a Moon colony of own nation or same-alliance nation", () => {
  const G = world();
  assert.equal(canFoundMars(G, "United States", socialAffinity), false, "no Moon colony");
  col(G, "EU Moon", { patron: "European Union" });
  assert.equal(canFoundMars(G, "United States", socialAffinity), true, "West ally on the Moon");
  assert.equal(canFoundMars(G, "China", socialAffinity), false, "East: not an ally");
  assert.equal(canFoundMars(G, "Latin Federation", socialAffinity), false, "Neutral counts only itself");
  col(G, "LF Moon", { patron: "Latin Federation" });
  assert.equal(canFoundMars(G, "Latin Federation", socialAffinity), true);
});

test("0.18.0 Thrust / Orbital Shipyard no longer open Mars", () => {
  const G = world();
  col(G, "Thruster", { patron: "China", body: "Mars", devs: { Thrust: 2 } });
  assert.equal(hasThrustReach(G, "China"), false);
  assert.equal(canFoundMars(G, "China", socialAffinity), false);
});

test("0.18.0 Mars imports only from Moon (and Mars) colonies, never Earth", () => {
  const G = world();
  const m = col(G, "Red", { body: "Mars", requires: "Food" });
  m.logisticsLines.push({ ...m.logisticsLines[0]!, id: "E1", reach: "earth" }); // even with an Earth-reach line
  bloc(G, "United States").excess = [{ node: "Food", claimedBy: null }];
  col(G, "Moon Farm", { devs: { Food: 2 } });
  const srcs = findSources(G, m, "Food");
  assert.ok(!srcs.some((s) => s.kind === "earth"), "no Earth source");
  assert.ok(srcs.some((s) => s.kind === "colony" && s.colony.body === "Moon"), "Moon colony source");
  const moon = col(G, "Moon", { requires: "Food" });
  assert.ok(findSources(G, moon, "Food").some((s) => s.kind === "earth"), "Moon still trades with Earth");
});

test("0.18.0 lending: allies always lend, opponents always refuse", () => {
  const G = world();
  const asker = col(G, "Asker", { requires: "Food" });
  asker.logisticsLines[0]!.lentTo = "x";
  col(G, "Rival", { patron: "China" });
  assert.equal(pickBestLender(G, asker), null, "East colony refuses a West one");
  const ally = col(G, "Ally", { patron: "European Union" });
  ally.acted = true;
  assert.equal(pickBestLender(G, asker)?.colony.id, ally.id);
});

test("0.18.0 an ally keeps the last free line it needs for its own Requires this turn", () => {
  const G = world();
  const asker = col(G, "Asker", { requires: "Food" });
  asker.logisticsLines[0]!.lentTo = "x";
  const ally = col(G, "Ally", { requires: "Water" });
  bloc(G, "United States").excess = [{ node: "Water", claimedBy: null }];
  assert.equal(pickBestLender(G, asker), null);
  ally.acted = true;
  assert.equal(pickBestLender(G, asker)?.colony.id, ally.id);
});

test("0.18.0 no hoarding: a bigger ally hands its cycling line to a smaller ally with no line", () => {
  const G = world();
  const small = col(G, "Small", { requires: "Food" });
  small.logisticsLines[0]!.lentTo = "x";
  const big = col(G, "Big", { devs: { Resources: 5 }, requires: "Thrust" });
  big.acted = true;
  bloc(G, "European Union").excess = [{ node: "Money", claimedBy: big.id }];
  big.logisticsLines[0]!.route = { sourceKind: "earth", sourceId: "European Union", sourceName: "European Union", node: "Money", slotIndex: 0, earthCycle: true };
  const pick = pickBestLender(G, small);
  assert.equal(pick?.colony.id, big.id);
  assert.equal(pick?.clearRoute, true);
});

test("0.18.0 Logistics loop: Earth Logistics first, then cycle with one free line, fill with spare lines", () => {
  const G = world();
  const c = col(G, "Loop", { requires: "Thrust", specialty: "Science" });
  c.developed.Food = 1; c.developed.Water = 1; c.developed.Oxygen = 1; c.developed.Resources = 1; c.developed.Energy = 1; c.developed.Infrastructure = 1;
  bloc(G, "United States").excess = [{ node: "Logistics", claimedBy: null }, { node: "Money", claimedBy: null }, { node: "Culture", claimedBy: null }];
  const n = c.logisticsLines.length;
  autoAct(G, c, mulberry32(1));
  assert.equal(c.logisticsLines.length, n + 1, "imported Earth Logistics (+1 line)");
  c.acted = false;
  autoAct(G, c, mulberry32(2));
  const filled = c.logisticsLines.filter((l) => l.route);
  assert.equal(filled.length, 1);
  assert.equal(!!filled[0]!.route!.earthCycle, false, "2 free lines → fill (kept), not a probe");
  c.acted = false;
  autoAct(G, c, mulberry32(3));
  assert.ok(c.logisticsLines.some((l) => l.route?.earthCycle), "last free line cycles Earth");
});
