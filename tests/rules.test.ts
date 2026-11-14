import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32 } from "../src/rng.js";
import { createGame, runTurn } from "../src/engine.js";
import { applyRules } from "../src/rules.js";

test("0.9.4 default rules keep colony growth sane and refugees rare", () => {
  // 0.21.0: colonization waves let every Earth bloc found by ~T30, so the default band is wider;
  // the 0.20.0 band (6–14) still holds with the 0.21.0 colonization rules off.
  const off021 = { colonizationWaves: false, firstFoundingWave: false, daughterColonies: false };
  for (const [patch, lo, hi] of [[{}, 8, 24], [off021, 6, 14]] as const) for (const seed of [42, 7]) {
    const rng = mulberry32(seed);
    const G = createGame(seed, rng);
    applyRules(G, patch);
    for (let t = 1; t <= 60; t++) {
      runTurn(G, rng);
      if (t === 40) assert.ok(G.colonies.length >= lo && G.colonies.length <= hi, `T40 colonies ${G.colonies.length}`);
    }
    const ref = G.log.filter((e) => /🏕 Refugees flee/.test(e.msg)).length;
    assert.ok(ref / 60 < 1.5, `refugees/turn ${ref / 60}`);
  }
});

test("0.10.0 L5 projects complete mid/late game only when enabled", () => {
  const run = (patch: Record<string, number | boolean>) => {
    const rng = mulberry32(42);
    const G = createGame(42, rng);
    applyRules(G, patch);
    for (let t = 1; t <= 100; t++) runTurn(G, rng);
    return G.log.filter((e) => /🏗 PROJECT:/.test(e.msg));
  };
  const on = run({});
  assert.ok(on.length > 0, "projects complete");
  assert.ok(on[0]!.turn >= 30, `first project T${on[0]!.turn}`);
  assert.equal(run({ l5Projects: false }).length, 0);
});

test("0.12.0 L7 overturns only late and can be disabled", () => {
  const run = (patch: Record<string, number | boolean>) => {
    const rng = mulberry32(7);
    const G = createGame(7, rng);
    applyRules(G, patch);
    for (let t = 1; t <= 130; t++) runTurn(G, rng);
    return G.log.filter((e) => /👑 OVERTURN/.test(e.msg));
  };
  const on = run({});
  assert.ok(on.every((e) => e.turn >= 90), "no early overturn");
  assert.equal(run({ l7Overturn: false }).length, 0);
});
