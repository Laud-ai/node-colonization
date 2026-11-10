// 0.20.0 (Tiago): the asteroid belt — Thrust = line reach, belt imports only from Mars, hostile, milestone. No new resources.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, makeColony, findSources, develop, cleanup, refreshBeltReach, lendLogisticsLine } from "../src/engine.js";
import { beltReachOf, beltThrust, canFoundBelt, foundingBodyFor } from "../src/nation.js";
import { reachSupports } from "../src/trade.js";
import { oxygenTripFor } from "../src/l4.js";
import { thrustOf } from "../src/l5.js";
import { tryRelay } from "../src/crises.js";
import { extras, NODES } from "../src/nodes.js";
import { mulberry32 } from "../src/rng.js";
import { applyRules } from "../src/rules.js";
import type { Body, Colony, GameState, NodeType } from "../src/types.js";

function world(rules: Record<string, boolean | number> | null = {}): GameState {
  const G = createGame(7);
  if (rules) applyRules(G, rules);
  G.colonies = [];
  for (const b of G.blocs) b.excess = [];
  return G;
}
function col(G: GameState, name: string, o: { requires?: NodeType; devs?: Partial<Record<NodeType, number>>; patron?: string; body?: Body; specialty?: NodeType } = {}): Colony {
  const c = makeColony(G, { patron: o.patron ?? "United States", body: o.body ?? "Mars", specialty: o.specialty ?? "Science",
    requires: o.requires ?? "Money", culture: ["American"], ideology: ["Liberal"], name });
  for (const n of NODES) c.developed[n] = o.devs?.[n] ?? 0;
  G.colonies.push(c);
  return c;
}
const rng = () => mulberry32(3);
const sociable = () => 1;

test("0.20.0 reach: Belt only with Mars, only on a Thrust (beltOk) line; Mars still not Earth", () => {
  assert.equal(reachSupports("mars", "Mars", "Belt", true), true);
  assert.equal(reachSupports("mars", "Mars", "Belt", false), false, "no Thrust → no belt");
  assert.equal(reachSupports("belt", "Belt", "Mars", true), true);
  assert.equal(reachSupports("earth", "Earth", "Belt", true), false, "never Earth");
  assert.equal(reachSupports("moon", "Moon", "Belt", true), false, "never Moon");
  assert.equal(reachSupports("belt", "Belt", "Belt", true), false, "no Belt↔Belt");
  assert.equal(reachSupports("mars", "Earth", "Mars"), false, "Mars still can't trade with Earth");
});

test("0.20.0 Thrust threshold gates belt reach; depot +1; rule off = no reach", () => {
  const G = world({ beltThrustReach: 2 });
  const m = col(G, "Mars A", { specialty: "Thrust" });
  assert.equal(beltThrust(G, m), 1);
  assert.equal(beltReachOf(G, m), false, "Thrust 1 < threshold 2");
  const b = col(G, "Belt Depot", { body: "Belt", specialty: "Thrust" });
  assert.equal(beltThrust(G, m), 2, "friendly belt depot adds +1");
  assert.equal(beltReachOf(G, m), true);
  assert.equal(beltThrust(G, b), thrustOf(b), "a depot does not count itself");
  const H = world({ beltThrustReach: 2, beltDepot: false });
  const m2 = col(H, "Mars A", { specialty: "Thrust" }); col(H, "Belt Depot", { body: "Belt", specialty: "Thrust" });
  assert.equal(beltThrust(H, m2), 1);
  const off = world({ beltColonies: false });
  assert.equal(beltReachOf(off, col(off, "Mars T", { specialty: "Thrust" })), false);
});

test("0.20.0 beltOk: owner Thrust sets it, belt base line always reaches Mars, lent lines carry it", () => {
  const G = world();
  const m = col(G, "Mars T", { specialty: "Thrust" });
  const weak = col(G, "Mars W");
  const b = col(G, "Belt B", { body: "Belt" });
  refreshBeltReach(G);
  assert.equal(m.logisticsLines[0]!.beltOk, true);
  assert.ok(!weak.logisticsLines[0]!.beltOk);
  assert.equal(b.logisticsLines[0]!.beltOk, true, "founding ship");
  // a line lent by the Thrust colony keeps the reach
  const extra = col(G, "Mars L", { specialty: "Logistics" });
  extra.developed.Thrust = 1;
  refreshBeltReach(G);
  const lent = extra.logisticsLines.find((l) => !l.route && l.kind !== "borrowed")!;
  assert.ok(lendLogisticsLine(G, extra, lent.id, weak), "same-bloc lend");
  refreshBeltReach(G);
  const got = weak.logisticsLines.find((l) => l.kind === "borrowed");
  assert.equal(got?.beltOk, true, "borrowed line reaches the belt via the lender's Thrust");
});

test("0.20.0 belt imports only from Mars (no Earth, Moon or other belt sources)", () => {
  const G = world();
  const belt = col(G, "Belt B", { body: "Belt", requires: "Food" });
  col(G, "Moon F", { body: "Moon", devs: { Food: 3 } });
  col(G, "Belt F", { body: "Belt", devs: { Food: 3 } });
  const mars = col(G, "Mars F", { devs: { Food: 3 } });
  refreshBeltReach(G);
  const src = findSources(G, belt, "Food");
  assert.ok(src.length > 0, "Mars exporter found");
  for (const s of src) {
    assert.equal(s.kind, "colony");
    if (s.kind === "colony") assert.equal(s.colony.id, mars.id);
  }
});

test("0.20.0 founding: needs a friendly Mars colony with belt reach; opponents don't count", () => {
  const G = world();
  assert.equal(canFoundBelt(G, "United States"), false);
  col(G, "China Mars", { patron: "China", specialty: "Thrust" });
  assert.equal(canFoundBelt(G, "United States"), false, "opponent's reach is not ours");
  assert.equal(canFoundBelt(G, "China"), true);
  col(G, "US Mars", { specialty: "Thrust" });
  assert.equal(canFoundBelt(G, "United States"), true);
  // body pick: Moon soft cap met + belt reach → Belt
  for (let i = 0; i < 12; i++) col(G, `Moon ${i}`, { body: "Moon" });
  col(G, "US Moon base", { body: "Moon" });
  assert.equal(foundingBodyFor(G, "United States", sociable), "Belt");
  const off = world({ beltColonies: false });
  col(off, "US Mars", { specialty: "Thrust" });
  assert.equal(canFoundBelt(off, "United States"), false);
});

test("0.20.0 belt colonies: rich specialty ×2, O₂ trip always 1, Terraforming does nothing", () => {
  const G = world();
  const c = makeColony(G, { patron: "United States", body: "Belt", specialty: "Science", requires: "Money", culture: ["American"], ideology: ["Liberal"], name: "Rock" });
  assert.equal(c.beltRich, true);
  assert.ok(["Thrust", "Production", "Resources", "Logistics"].includes(c.specialty), c.specialty);
  assert.notEqual(c.requires, c.specialty);
  for (const n of NODES) c.developed[n] = 0;
  G.colonies.push(c);
  assert.equal(extras(c, c.specialty), 2, "rich asteroid: specialty counts double");
  assert.equal(oxygenTripFor(G, "Belt"), 1);
  const plain = world({ beltRichSpecialty: false });
  const p = makeColony(plain, { patron: "United States", body: "Belt", specialty: "Science", requires: "Money", culture: ["American"], ideology: ["Liberal"], name: "Rock" });
  assert.ok(!p.beltRich); assert.equal(p.specialty, "Science");
  const tf0 = G.bodyTF.Belt;
  c.requires = "Terraforming";
  develop(G, c, rng());
  assert.equal(G.bodyTF.Belt, tf0, "no atmosphere to terraform");
});

test("0.20.0 milestone: first belt colony of a bloc gives bloc tech once; rule off = none", () => {
  const G = world();
  const us = G.blocs.find((b) => b.name === "United States")!;
  const t0 = us.tech;
  col(G, "Belt 1", { body: "Belt" });
  cleanup(G);
  assert.equal(us.tech, t0 + 2);
  col(G, "Belt 2", { body: "Belt" });
  cleanup(G);
  assert.equal(us.tech, t0 + 2, "only the first");
  const H = world({ beltMilestone: false });
  const us2 = H.blocs.find((b) => b.name === "United States")!;
  const t1 = us2.tech;
  col(H, "Belt 1", { body: "Belt" });
  cleanup(H);
  assert.equal(us2.tech, t1);
});

test("0.20.0 relay chain: a Mars relay line passes Earth supply on to the belt", () => {
  const G = world();
  const moon = col(G, "Moon A", { body: "Moon" });
  moon.logisticsLines[0]!.route = { sourceKind: "earth", sourceId: "United States", sourceName: "United States", node: "Food", counterNode: null, counterConsent: false };
  const mars = col(G, "Mars B", { requires: "Food", specialty: "Thrust" });
  mars.logisticsLines[0]!.route = { sourceKind: "colony", sourceId: moon.id, sourceName: moon.name, node: "Science", counterNode: null, counterConsent: false };
  assert.equal(tryRelay(G, mars, "Food", rng()), true, "Moon → Mars relay");
  const belt = col(G, "Belt C", { body: "Belt", requires: "Food" });
  belt.logisticsLines[0]!.route = { sourceKind: "colony", sourceId: mars.id, sourceName: mars.name, node: "Science", counterNode: null, counterConsent: false };
  refreshBeltReach(G);
  assert.equal(tryRelay(G, belt, "Food", rng()), true, "Mars → Belt relay (chain)");
  assert.equal(belt.logisticsLines.find((l) => l.relay)?.route?.node, "Food");
  cleanup(G);
  assert.ok(belt.logisticsLines.some((l) => l.relay), "chain survives the end-of-turn sweep");
  // the Moon giver loses its Earth import → the whole chain drops
  moon.logisticsLines[0]!.route = null;
  cleanup(G);
  assert.equal(belt.logisticsLines.some((l) => l.relay), false, "chain dropped with its root");
});
