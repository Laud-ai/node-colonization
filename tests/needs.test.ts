import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, runTurns } from "../src/engine.js";
import { mulberry32 } from "../src/rng.js";
import { NODES, extras, strainOf } from "../src/nodes.js";
import {
  noStrainExpansions, strainIfDeveloped, missingNodes, needsTree, listSuppliers, compareSuppliers, type Supplier,
} from "../src/needs.js";

function midGame() {
  const G = createGame(42);
  runTurns(G, 25, mulberry32(42));
  return G;
}

test("0.14.0 no-stress expansions = exactly the nodes whose develop adds no strain", () => {
  const G = midGame();
  for (const c of G.colonies) {
    const grey = new Set(noStrainExpansions(c));
    for (const n of NODES) {
      if (n === c.specialty || extras(c, n) > 0) { assert.ok(!grey.has(n)); continue; }
      assert.equal(grey.has(n), strainIfDeveloped(c, n) <= strainOf(c), `${c.name} ${n}`);
    }
  }
});

test("0.14.0 fresh colony: Resources is a no-stress expansion, Population is not (needs Food+Water)", () => {
  const G = createGame(7);
  const c = G.colonies[0]!;
  for (const n of NODES) c.developed[n] = 0;
  c.logisticsLines.forEach((l) => { l.route = null; l.exportRoute = null; });
  c.specialty = "Science"; c.requires = "Money";
  const grey = noStrainExpansions(c);
  assert.ok(grey.includes("Resources"));
  assert.ok(!grey.includes("Population"));
  assert.ok(!grey.includes("Science"), "specialty never listed");
  c.specialty = "Food"; c.developed.Water = 0;
  assert.ok(!noStrainExpansions(c).includes("Population"), "still missing Water");
  assert.ok(missingNodes(c).includes("Money"), "Requires is always missing");
  assert.ok(missingNodes(c).includes("Water"), "missing basal");
});

test("0.14.0 needs tree states + suppliers are read-only and sorted", () => {
  const G = midGame();
  const before = JSON.stringify(G);
  const c = G.colonies[0]!;
  const tree = needsTree(c);
  assert.equal(tree.length, NODES.length);
  assert.equal(tree.find((t) => t.node === c.requires)!.state, "missing");
  const all = listSuppliers(G, c, null, true);
  const water = listSuppliers(G, c, "Water", false);
  assert.ok(water.every((s) => s.node === "Water" && s.moveKey === null));
  for (let i = 1; i < all.length; i++) assert.ok(compareSuppliers(all[i - 1]!, all[i]!) <= 0);
  assert.equal(JSON.stringify(G), before, "analysis must not mutate state");
});

test("0.14.0 supplier sort: Requires → feasible → needs → own/ally → neutral → rival", () => {
  const mk = (p: Partial<Supplier>): Supplier => ({
    node: "Water", kind: "colony", id: "x", name: "X", location: "Moon", color: "#fff", flagKey: "x",
    relation: "neutral", legal: true, blocks: [], scope: "regional", line: "", replaces: "", allyHint: "",
    needRank: 1, engineRank: 0, moveKey: null, moveLabel: null, ...p,
  });
  const list = [
    mk({ name: "rival", relation: "rival" }),
    mk({ name: "grey-own", needRank: 2, relation: "own" }),
    mk({ name: "blocked-req", needRank: 0, legal: false }),
    mk({ name: "ally", relation: "ally" }),
    mk({ name: "req", needRank: 0 }),
    mk({ name: "illegal", legal: false, relation: "own" }),
    mk({ name: "own", relation: "own" }),
    mk({ name: "neutral" }),
  ].sort(compareSuppliers).map((s) => s.name);
  assert.deepEqual(list, ["req", "blocked-req", "own", "ally", "neutral", "rival", "grey-own", "illegal"]);
});
