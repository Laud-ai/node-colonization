// 0.21.1: Lineage trees (from blend / shift events) and the cluster graph (force layout from relation snapshots).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLineage } from "../src/lineage.js";
import { ClusterReplay, clusterFrame, distance } from "../src/cluster.js";
import { createGame, runTurn } from "../src/engine.js";
import { mulberry32 } from "../src/rng.js";
import { applyRules } from "../src/rules.js";
import type { GameEvent, GameState, TurnSnapshot } from "../src/types.js";

type Col = TurnSnapshot["cols"][number];
const col = (id: string, patron: string, o: Partial<Col> = {}): Col => ({ id, name: id.toUpperCase(), patron, liege: null, body: "Moon", level: 3, ideology: ["Liberal"], culture: ["American"], trade: [], war: false, fervor: 0, ...o });
const ev = (seq: number, turn: number, type: GameEvent["type"], colonies: string[], o: Partial<GameEvent> = {}): GameEvent =>
  ({ seq, turn, type, colonies, blocs: [], names: colonies.map((c) => c.toUpperCase()), text: "", ...o });

test("0.21.1 lineage: blend keeps both parents, shift links old → new, nodes note colonies and turns", () => {
  const timeline: TurnSnapshot[] = [{ turn: 1, alliances: {}, cols: [col("a", "US", { ideology: ["Liberal", "Pioneerism"] }), col("b", "China", { ideology: ["Socialism"] })] }];
  const events = [
    ev(0, 5, "ideology", ["a"], { tags: ["blend"], parents: ["Liberal", "Pioneerism"], before: { ideology: ["Liberal", "Pioneerism"] }, after: { ideology: ["Liberal-Pioneerism"] } }),
    ev(1, 9, "ideology", ["b"], { tags: ["overwrite"], parents: ["Socialism"], before: { ideology: ["Socialism"] }, after: { ideology: ["Technocracy"] } }),
    ev(2, 12, "ideology", ["b"], { tags: ["import"], before: { ideology: ["Technocracy"] }, after: { ideology: ["Technocracy", "Liberal-Pioneerism"] } }),
    ev(3, 7, "culture", ["a"], { tags: ["blend"], parents: ["American"], before: { culture: ["American"] }, after: { culture: ["American-hybrid"] } }),
  ];
  const L = buildLineage({ events, timeline }, "ideology");
  const edge = (f: string, t: string) => L.edges.find((e) => e.from === f && e.to === t);
  assert.equal(edge("Liberal", "Liberal-Pioneerism")?.kind, "blend");
  assert.equal(edge("Pioneerism", "Liberal-Pioneerism")?.kind, "blend");
  assert.equal(edge("Socialism", "Technocracy")?.kind, "shift");
  assert.equal(L.edges.length, 3, "imports add a site, not an edge");
  const lp = L.nodes.find((n) => n.tag === "Liberal-Pioneerism")!;
  assert.deepEqual(lp.sites.map((s) => [s.name, s.turn]), [["A", 5], ["B", 12]]);
  assert.equal(lp.first, 5);
  // top-to-bottom over time: children sit below their parents
  const y = (t: string) => L.nodes.find((n) => n.tag === t)!.y;
  assert.ok(y("Liberal-Pioneerism") > y("Liberal") && y("Technocracy") > y("Socialism"));
  // culture tree is separate
  const C = buildLineage({ events, timeline }, "culture");
  assert.equal(C.edges.length, 1);
  assert.equal(C.nodes.length, 2, "American, American-hybrid (b's American shares the node)");
  // per-colony filter: only b's own path
  const B = buildLineage({ events, timeline }, "ideology", "b");
  assert.deepEqual(B.nodes.map((n) => n.tag), ["Socialism", "Technocracy", "Liberal-Pioneerism"]);
  // the colony path also chains its import from the lead tag (dotted "adopt" edge), the general tree doesn't
  assert.deepEqual(B.edges.map((e) => `${e.from}→${e.to}:${e.kind}`), ["Socialism→Technocracy:shift", "Technocracy→Liberal-Pioneerism:adopt"]);
  assert.ok(!L.edges.some((e) => e.kind === "adopt"));
  assert.ok(B.nodes.every((n) => n.sites.every((s) => s.colonyId === "b")));
});

let game: GameState | null = null;
const real = () => {
  if (game) return game;
  const rng = mulberry32(42); const G = createGame(42, rng); applyRules(G);
  for (let t = 0; t < 80; t++) runTurn(G, rng);
  return (game = G);
};

test("0.21.1 lineage on a real game: every blend has its parents as nodes; colony paths are subsets", () => {
  const G = real();
  for (const kind of ["ideology", "culture"] as const) {
    const L = buildLineage(G, kind);
    const tags = new Set(L.nodes.map((n) => n.tag));
    assert.ok(L.nodes.length > 3);
    for (const e of L.edges) assert.ok(tags.has(e.from) && tags.has(e.to));
    const blends = G.events!.filter((e) => e.type === kind && e.tags?.includes("blend"));
    for (const b of blends) for (const p of b.parents ?? []) assert.ok(tags.has(p), `blend parent ${p} is a node`);
    for (const c of G.colonies.slice(0, 6)) {
      const P = buildLineage(G, kind, c.id);
      for (const n of P.nodes) assert.ok(tags.has(n.tag));
      for (const t of c[kind]) assert.ok(P.nodes.some((n) => n.tag === t), `${c.name} path reaches its current ${kind} ${t}`);
    }
  }
});

test("0.21.1 cluster: alliance pulls colonies together, war pushes them apart", () => {
  const snapFor = (allied: boolean, war: boolean): TurnSnapshot => ({
    turn: 3, alliances: { US: "West", EU: allied ? "West" : "East", China: "Neutral" },
    cols: [col("a", "US"), col("b", "EU", { ideology: ["Statism"] }), col("c", "China", { ideology: ["Statism"] })],
  });
  const warEv = [ev(0, 3, "war", ["a", "b"], { tags: ["invasion"] })];
  const d = (allied: boolean, war: boolean) => {
    let prev = null, f = null; const founders = new Map<string, string>();
    for (let i = 0; i < 6; i++) { f = clusterFrame({ ...snapFor(allied, war), turn: 3 }, war ? warEv : [], prev, founders); prev = new Map(f.nodes.map((n) => [n.id, { x: n.x, y: n.y }])); }
    return distance(f!, "a", "b");
  };
  const allied = d(true, false), rivals = d(false, false), atWar = d(false, true);
  assert.ok(allied < rivals, `allied ${allied.toFixed(0)} < rivals ${rivals.toFixed(0)}`);
  assert.ok(atWar > rivals, `war ${atWar.toFixed(0)} > rivals ${rivals.toFixed(0)}`);
  // fervor and independence drift a colony from its nation
  const near = clusterFrame({ turn: 1, alliances: { US: "West" }, cols: [col("a", "US")] }, [], null, new Map());
  const far = clusterFrame({ turn: 1, alliances: { US: "West" }, cols: [col("a", "US", { fervor: 12 })] }, [], null, new Map());
  assert.ok(distance(far, "a", "bloc:US") > distance(near, "a", "bloc:US"));
});

test("0.21.1 cluster replay is deterministic, warm-started and smooth", () => {
  const G = real();
  const A = new ClusterReplay(G.timeline!, G.events!), B = new ClusterReplay(G.timeline!, G.events!);
  const last = G.timeline!.length - 1;
  assert.deepEqual(A.frame(last), B.frame(last));
  // random access gives the same frame as sequential
  const C = new ClusterReplay(G.timeline!, G.events!);
  assert.deepEqual(C.frame(40), A.frame(40));
  for (let i = 1; i <= last; i++) {
    const p = A.frame(i - 1)!, f = A.frame(i)!;
    for (const n of f.nodes) {
      const q = p.nodes.find((x) => x.id === n.id);
      if (q) assert.ok(Math.hypot(q.x - n.x, q.y - n.y) <= 30.2, `turn ${f.turn} ${n.name} jumps`);
    }
  }
  assert.ok(A.frame(last)!.nodes.some((n) => n.kind === "bloc") && A.frame(last)!.nodes.some((n) => n.kind === "colony"));
});
