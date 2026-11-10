// 0.17.1 AI (Tiago): RP turn order, develops spread to smaller friends, work Earth instead of passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame, makeColony, runTurn, sortedColonies, tryFeedFriendRequires, pickBestLender,
  tryImportLogisticsForCapacity, tryRecallLentLine, reservedForSmallerFriends, findSources, tradeSourceKey,
  type PassDiag,
} from "../src/engine.js";
import { mulberry32 } from "../src/rng.js";
import { applyRules } from "../src/rules.js";
import { colonyLevel, rp, NODES } from "../src/nodes.js";
import type { Colony, GameState, NodeType } from "../src/types.js";

function world(rules: Record<string, boolean | number> | null = {}): GameState {
  const G = createGame(7);
  if (rules) applyRules(G, rules);
  G.colonies = [];
  for (const b of G.blocs) b.excess = [];
  return G;
}
function col(G: GameState, name: string, requires: NodeType, devs: Partial<Record<NodeType, number>> = {}, patron = "United States"): Colony {
  const c = makeColony(G, { patron, body: "Moon", specialty: "Science", requires, culture: ["American"], ideology: ["Liberal"], name });
  for (const n of NODES) c.developed[n] = devs[n] ?? 0;
  G.colonies.push(c);
  return c;
}
const us = (G: GameState) => G.blocs.find((b) => b.name === "United States")!;

test("0.17.1 turn order: highest RP first (rule on); hungriest first without rules", () => {
  for (const rules of [{}, null]) {
    const G = world(rules);
    const big = col(G, "Big", "Money", { Resources: 6 });
    const small = col(G, "Small", "Money");
    small.developed.Science = 2; // unmet deps → strain → hungrier
    assert.ok(rp(big, G.bodyTF) > rp(small, G.bodyTF));
    const first = sortedColonies(G)[0]!;
    assert.equal(first.name, rules ? "Big" : "Small");
  }
});

test("0.17.1 spread: a much bigger friend feeds a small colony's Requires from its surplus", () => {
  const G = world();
  const big = col(G, "Big", "Money", { Resources: 4, Culture: 1 });
  const small = col(G, "Small", "Culture");
  const lvl = colonyLevel(small);
  assert.ok(tryFeedFriendRequires(G, big, mulberry32(1), colonyLevel(big) - 3));
  assert.equal(colonyLevel(small), lvl + 1, "small colony developed");
  assert.ok(big.acted, "it used the big colony's action");
});

test("0.17.1 spread: no feeding across the gap limit or to non-friends", () => {
  const G = world();
  const big = col(G, "Big", "Money", { Resources: 1, Culture: 1 });
  col(G, "Small", "Culture");
  assert.equal(tryFeedFriendRequires(G, big, mulberry32(1), colonyLevel(big) - 3), false, "gap < 3");
  const G2 = world();
  const big2 = col(G2, "Big", "Money", { Resources: 4, Culture: 1 }, "United States");
  col(G2, "Rival", "Culture", {}, "China");
  assert.equal(tryFeedFriendRequires(G2, big2, mulberry32(1), 99), false, "West ≠ East");
});

test("0.17.1 spread: a big colony leaves a shared Earth Requires slot to a smaller friend", () => {
  const G = world();
  const big = col(G, "Big", "Food", { Resources: 4 });
  const small = col(G, "Small", "Food");
  us(G).excess = [{ node: "Food", claimedBy: null }];
  const src = findSources(G, big, "Food")[0]!;
  assert.ok(reservedForSmallerFriends(G, big, "Food").has(tradeSourceKey(src)));
  small.acted = true;
  assert.equal(reservedForSmallerFriends(G, big, "Food").size, 0, "no reservation once the small one acted");
});

test("0.17.1 spread: never borrow a line from a much smaller colony", () => {
  const G = world();
  const big = col(G, "Big", "Food", { Resources: 4 });
  const small = col(G, "Small", "Money");
  assert.equal(pickBestLender(G, big)?.colony.id, small.id);
  assert.equal(pickBestLender(G, big, undefined, colonyLevel(big) - 3 + 1), null);
});

test("0.17.1 spread: a small colony takes back a line lent for non-vital use to develop", () => {
  const G = world();
  const big = col(G, "Big", "Science", { Resources: 4 });
  const small = col(G, "Small", "Food");
  const own = small.logisticsLines[0]!;
  own.lentTo = big.id;
  us(G).excess = [{ node: "Money", claimedBy: big.id }, { node: "Food", claimedBy: null }];
  big.logisticsLines.push({ ...own, id: "B1", kind: "borrowed", lentTo: null, borrowedFrom: { colonyId: small.id, lineId: own.id },
    route: { sourceKind: "earth", sourceId: "United States", sourceName: "United States", node: "Money", slotIndex: 0 } } as Colony["logisticsLines"][number]);
  assert.ok(tryRecallLentLine(G, small, mulberry32(1)));
  assert.equal(own.lentTo, null);
  assert.ok(!big.logisticsLines.some((l) => l.id === "B1"));
});

test("0.17.1 active Earth: import Earth Logistics for a new line instead of passing", () => {
  const G = world();
  const c = col(G, "Busy", "Money");
  c.logisticsLines[0]!.lentTo = "elsewhere";
  us(G).excess = [{ node: "Logistics", claimedBy: null }];
  const n = c.logisticsLines.length;
  assert.ok(tryImportLogisticsForCapacity(G, c, mulberry32(1)));
  assert.equal(c.logisticsLines.length, n + 1);
  assert.equal(us(G).excess[0]!.claimedBy, c.id);
});

test("0.17.1 fewer passes than 0.17.0 AI on a real game (seed 42, 40 turns)", () => {
  const passes = (patch: Record<string, boolean>) => {
    const rng = mulberry32(42); const G = createGame(42, rng); applyRules(G, patch);
    const pt: PassDiag[] = []; Object.assign(G, { __passTrace: pt });
    for (let t = 0; t < 40; t++) runTurn(G, rng);
    return pt.length;
  };
  // 0.19.0 crisis rules pinned off on both sides: this test isolates the 0.17.1 AI rules
  const off019 = { relayLines: false, oxygenWars: false, nomadCamps: false, thinAirOxygen: false };
  const old = passes({ ...off019, aiTurnOrderRp: false, aiSpreadDevelop: false, aiActiveEarth: false });
  const now = passes(off019);
  assert.ok(now < old * 0.8, `passes ${now} vs ${old}`);
});
