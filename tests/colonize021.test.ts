// 0.21.0 "Living Colony": colonization waves (pressure, first-founding wave, daughters) + event log + colony History.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, makeColony, runTurn } from "../src/engine.js";
import { canSeedDaughter, colonizationPhase, foundFor, pressureRate } from "../src/colonize.js";
import { colonyHistory } from "../src/events.js";
import { hasNationFeedSurplus } from "../src/nation.js";
import { NODES } from "../src/nodes.js";
import { mulberry32 } from "../src/rng.js";
import { applyRules } from "../src/rules.js";
import type { GameState } from "../src/types.js";

const OFF021 = { colonizationWaves: false, firstFoundingWave: false, daughterColonies: false, eventLog: false };
function play(seed: number, turns: number, patch: Record<string, boolean | number> = {}): GameState {
  const rng = mulberry32(seed); const G = createGame(seed, rng); applyRules(G, patch);
  for (let t = 0; t < turns; t++) runTurn(G, rng);
  return G;
}
const bare = (patch: Record<string, boolean | number> = {}) => { const G = createGame(7); applyRules(G, patch); G.colonies = []; return G; };
const bloc = (G: GameState, name: string) => G.blocs.find((b) => b.name === name)!;
const colonized = new Map<number, GameState>();
const full = (seed: number) => { if (!colonized.has(seed)) colonized.set(seed, play(seed, 120)); return colonized.get(seed)!; };

test("0.21.0 pressure: blocs with no colony build faster; rivals add pull", () => {
  const G = bare();
  const eu = bloc(G, "European Union");
  const zero = pressureRate(G, eu);
  applyRules(G, { pressureZeroBoost: 1 });
  assert.ok(zero > pressureRate(G, eu), "zero-colony boost speeds the meter");
  const before = pressureRate(G, eu);
  for (let i = 0; i < 4; i++) G.colonies.push(makeColony(G, { patron: "China", body: "Moon", specialty: "Science", requires: "Money", culture: ["Chinese"], ideology: ["Socialism"], name: `R${i}` }));
  assert.ok(pressureRate(G, eu) > before, "rival colonies on a body without own colony add pressure");
});

test("0.21.0 first founding on a body is tax-free and opens a wave", () => {
  const G = bare();
  const eu = bloc(G, "European Union");
  const tech = eu.tech;
  const c = foundFor(G, eu, mulberry32(1), { body: "Moon", tags: ["pressure"] });
  assert.equal(c.patron, "European Union");
  assert.ok(c.foundTags?.includes("first") && c.foundTags.includes("pressure"));
  assert.equal(eu.tech, tech, "no founding tax for the first colony on a body");
  assert.ok(G.waves?.["European Union"]?.body === "Moon", "wave opened on the body");
  assert.ok(G.log.some((e) => /🌊 WAVE: European Union/.test(e.msg)));
});

test("0.21.0 every Earth bloc founds by midgame (seeds 42, 7, 99) and the 0.20.0 path is kept with rules off", () => {
  for (const seed of [42, 7, 99]) {
    const G = play(seed, 45);
    const founders = new Set(G.events!.filter((e) => e.type === "found").map((e) => e.blocs[0]));
    for (const b of G.blocs) assert.ok(founders.has(b.name) || G.turn < 1, `seed ${seed}: ${b.name} never founded by T45`);
    const off = play(seed, 45, OFF021);
    assert.equal(off.pressure, undefined, "no pressure meter with rules off");
    assert.ok(!off.log.some((e) => /🌊 WAVE/.test(e.msg)), "no waves with rules off");
    assert.ok(!off.colonies.some((c) => c.foundTags?.length), "no 0.21.0 founding tags with rules off");
    assert.equal(off.events?.length ?? 0, 0, "no event log with rules off");
  }
});

test("0.21.0 per-bloc per-turn cap on pressure / wave / daughter foundings", () => {
  for (const seed of [42, 7]) {
    const G = full(seed);
    const per = new Map<string, number>();
    for (const e of G.events!) if (e.type === "found" && e.tags?.some((t) => t === "pressure" || t === "wave" || t === "daughter")) {
      const k = `${e.turn}|${e.blocs[0]}`; per.set(k, (per.get(k) ?? 0) + 1);
    }
    assert.ok(per.size > 5, "pressure foundings happen");
    for (const [k, n] of per) assert.ok(n <= 1, `${k}: ${n} foundings in one turn`);
  }
});

test("0.21.0 waves fire, stay capped, and stall when the founder can't supply", () => {
  const G = full(42);
  const opened = G.log.filter((e) => /🌊 WAVE: /.test(e.msg)).length;
  const waveFounds = G.events!.filter((e) => e.type === "found" && e.tags?.includes("wave")).length;
  assert.ok(opened > 0, "waves open");
  assert.ok(waveFounds <= opened, `wave colonies (${waveFounds}) ≤ waves opened (${opened}) × waveMaxColonies 1`);
  // supply brake: a bloc with 2+ colonies and no feed surplus loses its wave
  const rng = mulberry32(5); const H = createGame(42, rng); applyRules(H);
  let tested = false;
  for (let t = 0; t < 80 && !tested; t++) {
    runTurn(H, rng);
    const b = H.blocs.find((x) => H.colonies.filter((c) => c.patron === x.name).length >= 2 && !hasNationFeedSurplus(H, x.name));
    if (!b) continue;
    (H.waves ??= {})[b.name] = { body: "Moon", start: H.turn, until: H.turn + 5, strength: 1, founded: 0, trigger: "test" };
    colonizationPhase(H, rng);
    assert.equal(H.waves[b.name], undefined, "wave stalls without supply");
    tested = true;
  }
  assert.ok(tested, "found a bloc without feed surplus to test the brake");
});

test("0.21.0 daughters: need level, inherit identity, record their parent", () => {
  const G = bare();
  const p = makeColony(G, { patron: "European Union", body: "Moon", specialty: "Science", requires: "Money", culture: ["European"], ideology: ["Liberal"], name: "Parent" });
  for (const n of NODES) p.developed[n] = 0;
  G.colonies.push(p);
  assert.equal(canSeedDaughter(G, p), false, "a level-1 colony can't seed");
  applyRules(G, { daughterColonies: false });
  assert.equal(canSeedDaughter(G, p), false);
  let daughters = 0;
  for (const seed of [42, 7, 99]) {
    const H = full(seed === 99 ? 99 : seed);
    for (const e of H.events!.filter((x) => x.type === "found" && x.tags?.includes("daughter"))) {
      daughters++;
      assert.ok(e.parentColony, "daughter event names its parent");
      const child = H.colonies.find((c) => c.id === e.colonies[0]);
      if (child) assert.equal(child.parentId, e.parentColony);
    }
  }
  assert.ok(daughters >= 1, "daughters occur in long games");
});

test("0.21.0 event log: tags, blend parents, no double revolution, one snapshot per turn", () => {
  const G = full(42);
  const ev = G.events!;
  assert.ok(ev.length > 100);
  assert.deepEqual(ev.map((e) => e.seq), ev.map((_, i) => i), "sequence numbers are contiguous");
  // a lone culture turns "X-hybrid" (one parent); two-tag blends keep both parents
  for (const e of ev.filter((x) => x.tags?.includes("blend"))) assert.ok((e.parents?.length ?? 0) >= 1, `blend keeps parents: ${e.text}`);
  assert.ok(ev.some((e) => e.tags?.includes("blend") && e.parents!.length >= 2), "two-parent blends recorded");
  const seen = new Set<string>();
  for (const e of ev.filter((x) => x.type === "revolution" || x.type === "independence")) {
    const k = `${e.turn}|${e.colonies[0]}`;
    assert.ok(!seen.has(k), `revolution recorded once: ${k}`); seen.add(k);
  }
  assert.ok(ev.some((e) => e.type === "war" || e.type === "seize" || e.type === "o2"), "conflicts recorded");
  assert.equal(G.timeline!.length, 120, "one relation snapshot per turn");
  const last = G.timeline![G.timeline!.length - 1]!;
  assert.equal(last.cols.length, G.colonies.length);
  assert.ok(Object.keys(last.alliances).length === G.blocs.length);
});

test("0.21.0 colony History: eras split on patron / ideology change, entries sorted", () => {
  const G = full(42);
  const withEras = G.colonies.map((c) => ({ c, h: colonyHistory(G, c.id) })).filter((x) => x.h.length > 1);
  assert.ok(withEras.length > 0, "some colony has several eras");
  for (const { h } of withEras) {
    for (let i = 1; i < h.length; i++) {
      assert.ok(h[i]!.patron !== h[i - 1]!.patron || h[i]!.ideology !== h[i - 1]!.ideology, "era boundary = patron or ideology change");
      assert.ok(h[i]!.from > h[i - 1]!.to - 1);
    }
    const turns = h.flatMap((e) => e.entries.map((x) => x.turn));
    assert.deepEqual(turns, [...turns].sort((a, b) => a - b));
    for (const e of h.flatMap((x) => x.entries)) assert.ok(e.text.length > 3 && !/undefined/.test(e.text), e.text);
  }
});

test("0.21.0 event log is a pure record: same game with it off", () => {
  const a = play(7, 60), b = play(7, 60, { eventLog: false });
  assert.deepEqual(a.colonies.map((c) => [c.id, c.patron, c.body, c.ideology.join("/")]), b.colonies.map((c) => [c.id, c.patron, c.body, c.ideology.join("/")]));
  assert.deepEqual(a.log.map((e) => e.msg), b.log.map((e) => e.msg));
  assert.equal(b.events?.length ?? 0, 0);
  assert.ok((a.events?.length ?? 0) > 0);
});
