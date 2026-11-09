import { blocFlag } from "../src/flagDesign.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, runTurns } from "../src/engine.js";
import { mulberry32 } from "../src/rng.js";
import { NODES, DEPS, extras, strainOf } from "../src/nodes.js";
import { BASAL_NODES } from "../src/l3.js";
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
  assert.ok(tree.find((t) => t.node === c.requires)!.why.startsWith("Requires"), "Requires is labelled (0.15.4: red only if a developed node needs it)");
  const all = listSuppliers(G, c, null, true);
  const water = listSuppliers(G, c, "Water", false);
  assert.ok(water.every((s) => s.node === "Water" && s.moveKey === null));
  for (let i = 1; i < all.length; i++) assert.ok(compareSuppliers(all[i - 1]!, all[i]!) <= 0);
  assert.equal(JSON.stringify(G), before, "analysis must not mutate state");
});

test("0.14.0 supplier sort: Requires → feasible → needs → own/ally → neutral → rival", () => {
  const mk = (p: Partial<Supplier>): Supplier => ({
    node: "Water", kind: "colony", id: "x", name: "X", location: "Moon", color: "#fff", flagKey: "x", flag: blocFlag("United Nations"),
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

function freshColony() {
  const G = createGame(7);
  const c = G.colonies[0]!;
  for (const n of NODES) c.developed[n] = 0;
  c.logisticsLines.forEach((l) => { l.route = null; l.exportRoute = null; });
  c.specialty = "Science"; c.requires = "Money";
  return { G, c };
}

test("0.15.4 fresh colony: no red, basics grey, the rest locked", () => {
  const { c } = freshColony();
  const tree = needsTree(c);
  const st = (n: string) => tree.find((t) => t.node === n)!.state;
  assert.equal(tree.filter((t) => t.state === "missing").length, 0, "nothing developed → nothing red");
  assert.equal(st("Resources"), "expand");
  for (const n of ["Water", "Oxygen", "Food", "Energy", "Infrastructure"]) assert.equal(st(n), "expand", `${n} basic → grey`);
  assert.equal(st("Population"), "locked", "needs Food + Water first");
  assert.equal(st("Money"), "locked", "Requires is not red by itself");
  assert.equal(st("Science"), "specialty");
  c.developed.Resources = 1;
  const t2 = needsTree(c);
  const st2 = (n: string) => t2.find((t) => t.node === n)!.state;
  assert.equal(st2("Infrastructure"), "expand", "prereq Resources now present");
  assert.equal(t2.filter((t) => t.state === "missing").length, 0, "Resources has no prerequisites");
});

test("0.15.4 red only directly below a developed node that needs it", async () => {
  const { classifyNeed, neededByDeveloped } = await import("../src/needs.js");
  const { G, c } = freshColony();
  c.developed.Resources = 1; c.developed.Infrastructure = 1; c.developed.Energy = 1; c.developed.Food = 1;
  c.developed.Population = 1; // needs Food + Water directly
  const line = c.logisticsLines[0]!;
  line.route = { node: "Oxygen", sourceKind: "earth", sourceId: G.blocs[0]!.name, sourceName: G.blocs[0]!.name } as never;
  const tree = needsTree(c);
  const st = (n: string) => tree.find((t) => t.node === n)!.state;
  assert.equal(st("Water"), "missing", "directly below developed Population");
  assert.deepEqual(neededByDeveloped(c, "Water"), ["Population"]);
  assert.equal(extras(c, "Oxygen") > 0 ? st("Oxygen") : "imported", "imported");
  assert.equal(st("Science"), "specialty");
  assert.equal(st("Resources"), "developed");
  assert.equal(st("Culture"), "expand", "Population present");
  assert.equal(st("Money"), "locked", "needs Production too");
  assert.equal(st("Subversion"), "locked");
  // every red node is a direct prerequisite of a developed node and is not owned
  for (const t of tree.filter((x) => x.state === "missing")) {
    assert.ok(neededByDeveloped(c, t.node).length > 0 && extras(c, t.node) === 0, t.node);
  }
  assert.equal(classifyNeed(c, "Resources"), "developed", "owned beats everything");
  const states = new Set(tree.map((t) => t.state));
  for (const s2 of ["specialty", "developed", "imported", "missing", "expand", "locked"]) assert.ok(states.has(s2 as never), s2);
  // mid-game invariant on real games
  const M = midGame();
  for (const col of M.colonies) for (const t of needsTree(col)) {
    if (t.state === "missing") assert.ok(neededByDeveloped(col, t.node).length > 0 && extras(col, t.node) === 0);
    if (t.state === "expand") assert.ok(BASAL_NODES.includes(t.node) || (DEPS[t.node] || []).every((d) => extras(col, d) > 0));
  }
});
