// 0.19.0 (Tiago): relay lines, oxygen wars, nomad camps, thin air — each behind its own rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, makeColony, clearRouteOnLine, canInvade } from "../src/engine.js";
import { tryRelay, runOxygenCrisis, markHoarders, nomadRefugees, campAct, timedFervor } from "../src/crises.js";
import { oxygenTripFor, clockTripsFor, hasCasusBelli } from "../src/l4.js";
import { extraFervor } from "../src/fervorHooks.js";
import { mulberry32 } from "../src/rng.js";
import { applyRules } from "../src/rules.js";
import { NODES, freeLines } from "../src/nodes.js";
import type { Body, Colony, GameState, NodeType } from "../src/types.js";

function world(rules: Record<string, boolean | number> | null = {}): GameState {
  const G = createGame(7);
  if (rules) applyRules(G, rules);
  G.colonies = [];
  for (const b of G.blocs) b.excess = [];
  return G;
}
function col(G: GameState, name: string, o: { requires?: NodeType; devs?: Partial<Record<NodeType, number>>; patron?: string; body?: Body; specialty?: NodeType; ideology?: string[] } = {}): Colony {
  const c = makeColony(G, { patron: o.patron ?? "United States", body: o.body ?? "Moon", specialty: o.specialty ?? "Science",
    requires: o.requires ?? "Money", culture: ["American"], ideology: o.ideology ?? ["Liberal"], name });
  for (const n of NODES) c.developed[n] = o.devs?.[n] ?? 0;
  G.colonies.push(c);
  return c;
}
function earthImport(c: Colony, node: NodeType): void {
  const l = c.logisticsLines[0]!;
  l.route = { sourceKind: "earth", sourceId: "United States", sourceName: "United States", node, counterNode: null, counterConsent: false };
}
const rng = () => mulberry32(3);

test("0.19.0 relay: a Moon colony passes its Earth Food line on to a Mars colony (develops it)", () => {
  const G = world();
  const a = col(G, "Moon A"); earthImport(a, "Food");
  const m = col(G, "Mars B", { body: "Mars", requires: "Food" });
  m.logisticsLines[0]!.route = { sourceKind: "colony", sourceId: a.id, sourceName: a.name, node: "Science", counterNode: null, counterConsent: false };
  const before = Object.values(m.developed).reduce((s, x) => s + x, 0);
  assert.equal(tryRelay(G, m, "Food", rng()), true);
  assert.equal(a.logisticsLines[0]!.relayTo?.colonyId, m.id, "giver line marked");
  const rl = m.logisticsLines.find((l) => l.relay)!;
  assert.equal(rl.route?.node, "Food"); assert.equal(rl.route?.sourceId, a.id);
  assert.ok(Object.values(m.developed).reduce((s, x) => s + x, 0) > before, "Requires delivered → develop");
  assert.equal(freeLines(m).some((l) => l.relay), false, "a relay is never a free line");
  // only ONE relay per line
  const m2 = col(G, "Mars C", { body: "Mars", requires: "Food" });
  m2.logisticsLines[0]!.route = { sourceKind: "colony", sourceId: a.id, sourceName: a.name, node: "Science", counterNode: null, counterConsent: false };
  assert.equal(tryRelay(G, m2, "Food", rng()), false);
  // giver ends its Earth import → relay ends
  clearRouteOnLine(G, a, a.logisticsLines[0]!, rng(), true);
  assert.equal(m.logisticsLines.some((l) => l.relay), false);
});

test("0.19.0 relay: opponents refuse, rule off = no relay", () => {
  const G = world();
  const a = col(G, "China Moon", { patron: "China" }); earthImport(a, "Food");
  const m = col(G, "US Moon", { requires: "Food" });
  m.logisticsLines[0]!.route = { sourceKind: "colony", sourceId: a.id, sourceName: a.name, node: "Science", counterNode: null, counterConsent: false };
  assert.equal(tryRelay(G, m, "Food", rng()), false, "West↔East");
  const H = world({ relayLines: false });
  const b = col(H, "Moon A"); earthImport(b, "Food");
  const n = col(H, "Moon B", { requires: "Food" });
  assert.equal(tryRelay(H, n, "Food", rng()), false);
});

test("0.19.0 thin air: Oxygen clock 2/3 turns on part-terraformed bodies", () => {
  const G = world();
  const t = (tf: number) => { G.bodyTF.Mars = tf; return oxygenTripFor(G, "Mars"); };
  assert.deepEqual([t(0), t(1), t(4), t(5), t(9), t(10)], [1, 2, 2, 3, 3, 1]);
  G.bodyTF.Mars = 6;
  assert.equal(clockTripsFor(G, col(G, "M", { body: "Mars" })).oxygen, 3);
  const H = world({ thinAirOxygen: false }); H.bodyTF.Mars = 6;
  assert.equal(oxygenTripFor(H, "Mars"), 1);
});

test("0.19.0 oxygen wars: an ally answers the plea for free", () => {
  const G = world();
  const c = col(G, "Choking", { devs: { Population: 1 } });
  c.oxygenClock = 1; c.oxygenCrisis = { since: G.turn, shortfall: 1, suppliers: [] };
  const cr = c.oxygenCrisis;
  const s = col(G, "Ally Air", { patron: "European Union", devs: { Oxygen: 3 } });
  assert.equal(runOxygenCrisis(G, c, rng()), true);
  assert.ok(c.logisticsLines.some((l) => l.route?.node === "Oxygen" && l.route.sourceId === s.id), "O₂ import started");
  assert.equal(c.oxygenCrisis ?? null, null, "crisis over");
  assert.match(cr.actions!.join(), /plea: Ally Air sends O₂ \(free \(ally\)\)/);
});

test("0.19.0 oxygen wars: refusal → casus belli (allies may join, no threat block) → seizure; hoarder mark → partner fervor", () => {
  const G = world();
  const c = col(G, "Choking", { devs: { Population: 1, Military: 1, Science: 3 } });
  c.oxygenClock = 1; c.oxygenCrisis = { since: G.turn, shortfall: 1, suppliers: [] };
  const cr = c.oxygenCrisis;
  const h = col(G, "Hoarder", { patron: "China", ideology: ["Collectivist"], devs: { Oxygen: 2 } });
  const partner = col(G, "Partner", { patron: "China" });
  partner.logisticsLines[0]!.route = { sourceKind: "colony", sourceId: h.id, sourceName: h.name, node: "Science", counterNode: null, counterConsent: false };
  assert.equal(runOxygenCrisis(G, c, rng()), true);
  assert.deepEqual(cr.refusedBy, [h.id]);
  assert.equal(c.casusBelli?.[0]?.targetId, h.id);
  const ally = col(G, "Ally", { devs: { Military: 1 } });
  assert.equal(hasCasusBelli(G, ally, h), true, "same nation shares the casus belli");
  assert.equal(canInvade(G, ally, h), true);
  assert.match(G.log.map((e) => e.msg).join("\n"), /tries to seize Oxygen from Hoarder \(justified\)/);
  c.oxygenCrisis = cr; markHoarders(G, c);
  assert.ok((h.hoarderUntil ?? 0) > G.turn);
  assert.equal(timedFervor(G, partner), 2);
  assert.ok(extraFervor(G, partner) >= 2);
});

test("0.19.0 oxygen wars off = no plea / seizure", () => {
  const G = world({ oxygenWars: false });
  const c = col(G, "Choking", { devs: { Population: 1 } });
  c.oxygenCrisis = { since: G.turn, shortfall: 1, suppliers: [] };
  col(G, "Air", { devs: { Oxygen: 3 } });
  assert.equal(runOxygenCrisis(G, c, rng()), false);
});

test("0.19.0 nomads: a friendly host with room accepts (+1 Population, fervor)", () => {
  const G = world();
  const o = col(G, "Hungry");
  const h = col(G, "Granary", { devs: { Food: 3, Water: 3, Oxygen: 3 } });
  assert.equal(nomadRefugees(G, o, "food", rng()), true);
  assert.equal(h.developed.Population, 1);
  assert.ok(timedFervor(G, h) >= 1);
});

test("0.19.0 nomads: all refuse → camp raids the undefended, becomes Independent; off = old path", () => {
  const G = world();
  const o = col(G, "Hungry", { patron: "China", ideology: ["Collectivist"] });
  const r = col(G, "Rich", { devs: { Food: 3, Water: 3, Oxygen: 3 } }); // West: opponent, no Subversion → refuses
  assert.equal(nomadRefugees(G, o, "food", rng()), true);
  const camp = G.colonies.find((c) => c.nomad)!;
  assert.ok(camp, "camp settled");
  assert.deepEqual(camp.nomad!.rejectedBy, [r.id]);
  G.turn += 3; campAct(G, camp, rng());
  assert.equal(r.developed.Food, 2, "raid takes surplus Food");
  G.turn = camp.nomad!.since + 20; campAct(G, camp, rng());
  assert.equal(camp.nomad, null, "camp → Independent founder");
  const H = world({ nomadCamps: false });
  assert.equal(nomadRefugees(H, col(H, "X"), "food", rng()), false);
});

test("0.19.0 nomads: a defended colony repels raids; camp absorbed after max repels", () => {
  const G = world();
  const o = col(G, "Hungry", { patron: "China", ideology: ["Collectivist"] });
  const r = col(G, "Fort", { devs: { Food: 3, Water: 3, Oxygen: 3, Military: 2, Stability: 1 } });
  nomadRefugees(G, o, "food", rng());
  const camp = G.colonies.find((c) => c.nomad)!;
  for (let i = 0; i < 3; i++) { G.turn += 3; campAct(G, camp, rng()); }
  assert.equal(r.developed.Food, 3);
  assert.equal(camp.nomad, null);
  assert.equal(camp.patron, r.patron, "absorbed by the defender");
});
