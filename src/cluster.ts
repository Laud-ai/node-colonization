/**
 * 0.21.1 Cluster graph: deterministic force-directed layout of Earth blocs + colonies per turn,
 * driven by the 0.21.0 relation snapshots (timeline) and event log. Pure (no DOM).
 * Pulls: colony↔patron (weakens as fervor rises), same bloc, allied blocs, trade lines, shared lead ideology.
 * Pushes: war / seizure / raid pairs (recent), rival alliances, O₂ hoarders. Warm-started from the previous turn.
 */
import type { GameEvent, TurnSnapshot } from "./types.js";

export interface ClusterParams {
  repulse: number; patronPull: number; patronLen: number; fervorScale: number; indepPull: number; indepLen: number;
  blocPull: number; allyPull: number; allyLen: number; tradePull: number; ideologyPull: number;
  warPush: number; warLen: number; warMemory: number; rivalPush: number; hoarderPush: number; hoarderMemory: number;
  gravity: number; iterFirst: number; iterWarm: number; maxStep: number; maxTurnMove: number;
}
export const CLUSTER_DEFAULTS: ClusterParams = {
  repulse: 2600, patronPull: 0.08, patronLen: 45, fervorScale: 5, indepPull: 0.006, indepLen: 220,
  blocPull: 0.012, allyPull: 0.03, allyLen: 130, tradePull: 0.03, ideologyPull: 0.008,
  warPush: 0.05, warLen: 320, warMemory: 6, rivalPush: 3, hoarderPush: 2, hoarderMemory: 10,
  gravity: 0.012, iterFirst: 220, iterWarm: 45, maxStep: 18, maxTurnMove: 30,
};
export interface ClusterNode { id: string; kind: "bloc" | "colony"; name: string; bloc: string; x: number; y: number; independent: boolean; fervor: number }
export interface ClusterEdge { a: string; b: string; kind: "ally" | "war" | "patron" }
export interface ClusterFrame { turn: number; nodes: ClusterNode[]; edges: ClusterEdge[] }
export type Positions = Map<string, { x: number; y: number }>;

const INDEP = "Independent";
const blocId = (b: string) => `bloc:${b}`;
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

interface Spring { a: number; b: number; k: number; len: number }

/** Recent conflict pairs + hoarders up to `turn` (inclusive). */
function conflicts(events: GameEvent[], turn: number, p: ClusterParams) {
  const wars: [string, string][] = []; const hoarders = new Set<string>();
  for (const e of events) {
    if (e.turn > turn) break;
    if ((e.type === "war" || e.type === "seize" || e.type === "raid") && e.colonies.length >= 2 && turn - e.turn < p.warMemory) wars.push([e.colonies[0]!, e.colonies[1]!]);
    if (e.type === "o2" && e.tags?.includes("hoarder") && e.colonies[0] && turn - e.turn < p.hoarderMemory) hoarders.add(e.colonies[0]);
  }
  return { wars, hoarders };
}

/** One turn's layout, warm-started from `prev` (positions of the previous frame). */
export function clusterFrame(snap: TurnSnapshot, events: GameEvent[], prev: Positions | null, founders: Map<string, string>, p: ClusterParams = CLUSTER_DEFAULTS): ClusterFrame {
  const blocs = Object.keys(snap.alliances).sort();
  const nodes: ClusterNode[] = [];
  const R = 260;
  blocs.forEach((b, i) => {
    const a = (i / blocs.length) * Math.PI * 2;
    const q = prev?.get(blocId(b)) ?? { x: Math.cos(a) * R, y: Math.sin(a) * R };
    nodes.push({ id: blocId(b), kind: "bloc", name: b, bloc: b, x: q.x, y: q.y, independent: false, fervor: 0 });
  });
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  for (const c of snap.cols) {
    if (!founders.has(c.id)) founders.set(c.id, c.patron === INDEP ? (c.liege ? founders.get(c.liege) ?? INDEP : INDEP) : c.patron);
    const indep = c.patron === INDEP;
    const anchor = indep ? founders.get(c.id)! : c.patron;
    let q = prev?.get(c.id);
    if (!q) {
      const base = (index.has(blocId(anchor)) ? nodes[index.get(blocId(anchor))!] : null) ?? { x: 0, y: 0 };
      const a = hash(c.id) * Math.PI * 2, r = 20 + hash(c.id + "r") * 20;
      q = { x: base.x + Math.cos(a) * r, y: base.y + Math.sin(a) * r };
    }
    index.set(c.id, nodes.length);
    nodes.push({ id: c.id, kind: "colony", name: c.name, bloc: anchor, x: q.x, y: q.y, independent: indep, fervor: c.fervor ?? 0 });
  }
  const springs: Spring[] = [];
  const edges: ClusterEdge[] = [];
  const at = (id: string) => index.get(id);
  const add = (a: string, b: string, k: number, len: number) => { const i = at(a), j = at(b); if (i !== undefined && j !== undefined && i !== j) springs.push({ a: i, b: j, k, len }); };
  const alliance = (b: string) => snap.alliances[b] ?? "Neutral";
  for (let i = 0; i < blocs.length; i++) for (let j = i + 1; j < blocs.length; j++) {
    const A = alliance(blocs[i]!), B = alliance(blocs[j]!);
    if (A === B && A !== "Neutral") { add(blocId(blocs[i]!), blocId(blocs[j]!), p.allyPull, p.allyLen); edges.push({ a: blocId(blocs[i]!), b: blocId(blocs[j]!), kind: "ally" }); }
  }
  const cols = snap.cols;
  for (const c of cols) {
    const f = Math.max(0, c.fervor ?? 0);
    if (c.patron !== INDEP) { add(c.id, blocId(c.patron), p.patronPull / (1 + f / p.fervorScale), p.patronLen * (1 + f / p.fervorScale)); edges.push({ a: c.id, b: blocId(c.patron), kind: "patron" }); }
    else add(c.id, blocId(founders.get(c.id)!), p.indepPull, p.indepLen);
    for (const t of c.trade) add(c.id, t, p.tradePull, 60);
  }
  for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) {
    const a = cols[i]!, b = cols[j]!;
    if (a.patron === b.patron && a.patron !== INDEP) add(a.id, b.id, p.blocPull, 70);
    if (a.ideology[0] && a.ideology[0] === b.ideology[0]) add(a.id, b.id, p.ideologyPull, 90);
  }
  const { wars, hoarders } = conflicts(events, snap.turn, p);
  for (const c of cols) if (c.hoarder) hoarders.add(c.id);
  const warSet = new Set<string>();
  for (const [a, b] of wars) {
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (warSet.has(k)) continue; warSet.add(k);
    add(a, b, p.warPush, p.warLen);
    if (at(a) !== undefined && at(b) !== undefined) edges.push({ a, b, kind: "war" });
  }
  // extra repulsion multipliers
  const mult = (i: number, j: number): number => {
    const A = nodes[i]!, B = nodes[j]!;
    let m = 1;
    if (A.kind === "bloc" && B.kind === "bloc") { const x = alliance(A.bloc), y = alliance(B.bloc); if (x !== y && x !== "Neutral" && y !== "Neutral") m *= p.rivalPush; }
    if (hoarders.has(A.id) || hoarders.has(B.id)) m *= p.hoarderPush;
    return m;
  };
  const n = nodes.length;
  const M: number[] = new Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) M[i * n + j] = mult(i, j);
  const iters = prev ? p.iterWarm : p.iterFirst;
  const dx = new Float64Array(n), dy = new Float64Array(n);
  for (let it = 0; it < iters; it++) {
    dx.fill(0); dy.fill(0);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let x = nodes[i]!.x - nodes[j]!.x, y = nodes[i]!.y - nodes[j]!.y;
      let d2 = x * x + y * y;
      if (d2 < 1) { x = 0.5 + hash(nodes[i]!.id + nodes[j]!.id) ; y = 0.5; d2 = x * x + y * y; }
      const f = (p.repulse * M[i * n + j]!) / d2;
      const d = Math.sqrt(d2);
      dx[i] += (x / d) * f; dy[i] += (y / d) * f; dx[j] -= (x / d) * f; dy[j] -= (y / d) * f;
    }
    for (const s of springs) {
      const A = nodes[s.a]!, B = nodes[s.b]!;
      const x = B.x - A.x, y = B.y - A.y, d = Math.sqrt(x * x + y * y) || 1;
      const f = s.k * (d - s.len);
      dx[s.a] += (x / d) * f; dy[s.a] += (y / d) * f; dx[s.b] -= (x / d) * f; dy[s.b] -= (y / d) * f;
    }
    const temp = p.maxStep * (1 - it / (iters + 1));
    for (let i = 0; i < n; i++) {
      dx[i] -= nodes[i]!.x * p.gravity; dy[i] -= nodes[i]!.y * p.gravity;
      const m = Math.sqrt(dx[i]! * dx[i]! + dy[i]! * dy[i]!);
      const s = m > temp ? temp / m : 1;
      nodes[i]!.x += dx[i]! * s; nodes[i]!.y += dy[i]! * s;
    }
  }
  // smooth replay: a node that existed last turn moves at most maxTurnMove per turn (the layout settles over turns)
  for (const nd of nodes) {
    const q = prev?.get(nd.id);
    if (q) { const x = nd.x - q.x, y = nd.y - q.y, d = Math.hypot(x, y); if (d > p.maxTurnMove) { nd.x = q.x + (x / d) * p.maxTurnMove; nd.y = q.y + (y / d) * p.maxTurnMove; } }
    nd.x = Math.round(nd.x * 10) / 10; nd.y = Math.round(nd.y * 10) / 10;
  }
  return { turn: snap.turn, nodes, edges };
}

/** Frames over the whole timeline, each warm-started from the one before (cached; deterministic). */
export class ClusterReplay {
  private frames: ClusterFrame[] = [];
  private founders = new Map<string, string>();
  constructor(private timeline: TurnSnapshot[], private events: GameEvent[], private p: ClusterParams = CLUSTER_DEFAULTS) {}
  get length(): number { return this.timeline.length; }
  /** Refresh sources (live game grew); keeps cached frames for unchanged turns. */
  update(timeline: TurnSnapshot[], events: GameEvent[]): void {
    if (timeline !== this.timeline && (timeline.length < this.frames.length || timeline[0]?.turn !== this.timeline[0]?.turn)) { this.frames = []; this.founders.clear(); }
    this.timeline = timeline; this.events = events;
  }
  frame(i: number): ClusterFrame | null {
    if (i < 0 || i >= this.timeline.length) return null;
    while (this.frames.length <= i) {
      const k = this.frames.length;
      const prev = k ? new Map(this.frames[k - 1]!.nodes.map((n) => [n.id, { x: n.x, y: n.y }])) : null;
      this.frames.push(clusterFrame(this.timeline[k]!, this.events, prev, this.founders, this.p));
    }
    return this.frames[i]!;
  }
}

export function distance(f: ClusterFrame, a: string, b: string): number {
  const A = f.nodes.find((n) => n.id === a), B = f.nodes.find((n) => n.id === b);
  if (!A || !B) return NaN;
  return Math.hypot(A.x - B.x, A.y - B.y);
}
