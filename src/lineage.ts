/**
 * 0.21.1 Lineage: ideology / culture family trees built from the 0.21.0 event log + per-turn snapshots.
 * Pure (no DOM). Nodes = tags; edges = shift / blend / overwrite (old tag → new tag); blends keep both parents.
 */
import type { GameEvent, TurnSnapshot } from "./types.js";

export type LineageKind = "ideology" | "culture";
export interface LineageSite { colonyId: string; name: string; turn: number; how: string }
export interface LineageNode { tag: string; first: number; sites: LineageSite[]; x: number; y: number; lane: number }
export interface LineageEdge { from: string; to: string; kind: "blend" | "shift" | "adopt"; sites: LineageSite[]; first: number }
export interface Lineage { kind: LineageKind; colonyId: string | null; nodes: LineageNode[]; edges: LineageEdge[]; turns: number[] }
export interface LineageSource { events?: GameEvent[]; timeline?: TurnSnapshot[] }

const HOW: Record<string, string> = { blend: "blend", overwrite: "overwrite", shift: "shift", import: "import", develop: "develop" };

export function buildLineage(src: LineageSource, kind: LineageKind, colonyId: string | null = null): Lineage {
  const nodes = new Map<string, LineageNode>();
  const edges = new Map<string, LineageEdge>();
  const site = (tag: string, s: LineageSite) => {
    let n = nodes.get(tag);
    if (!n) { n = { tag, first: s.how === "parent" ? s.turn - 0.5 : s.turn, sites: [], x: 0, y: 0, lane: 0 }; nodes.set(tag, n); }
    // a tag first seen only as a blend parent sits half a row above the blend
    n.first = Math.min(n.first, s.how === "parent" ? s.turn - 0.5 : s.turn);
    if (!n.sites.some((x) => x.colonyId === s.colonyId && x.turn === s.turn && x.how === s.how)) n.sites.push(s);
  };
  const edge = (from: string, to: string, k: LineageEdge["kind"], s: LineageSite) => {
    if (from === to) return;
    const key = `${from}→${to}`;
    let e = edges.get(key);
    if (!e) { e = { from, to, kind: k, sites: [], first: s.turn }; edges.set(key, e); }
    if (k === "blend" || (k === "shift" && e.kind === "adopt")) e.kind = k;
    e.first = Math.min(e.first, s.turn);
    if (!e.sites.some((x) => x.colonyId === s.colonyId && x.turn === s.turn)) e.sites.push(s);
  };
  // roots: the tags each colony held when it first appears in the timeline
  const seen = new Set<string>();
  for (const snap of src.timeline ?? []) for (const c of snap.cols) {
    if (seen.has(c.id) || (colonyId && c.id !== colonyId)) continue;
    seen.add(c.id);
    for (const t of c[kind]) site(t, { colonyId: c.id, name: c.name, turn: snap.turn, how: "founded" });
  }
  for (const e of src.events ?? []) {
    if (e.type !== kind) continue;
    const id = e.colonies[0];
    if (!id || (colonyId && id !== colonyId)) continue;
    const name = e.names[0] ?? id;
    const before = (e.before?.[kind] as string[] | undefined) ?? [];
    const after = (e.after?.[kind] as string[] | undefined) ?? [];
    const added = after.filter((t) => !before.includes(t));
    const removed = before.filter((t) => !after.includes(t));
    const how = (e.tags ?? []).map((t) => HOW[t]).find(Boolean) ?? "shift";
    const s = (t: string): LineageSite => ({ colonyId: id, name, turn: e.turn, how });
    for (const t of added) {
      site(t, s(t));
      if (how === "blend") for (const p of e.parents ?? []) { site(p, { ...s(p), how: "parent" }); edge(p, t, "blend", s(t)); }
      else if (removed.length) for (const p of removed) edge(p, t, "shift", s(t));
      // a single colony's path: chain imports / developments from its lead tag before
      else if (colonyId && before[0]) edge(before[0], t, "adopt", s(t));
    }
    // a blend that keeps its own name (no added tag) still links parents → result
    if (!added.length && how === "blend" && after[0]) for (const p of e.parents ?? []) if (p !== after[0]) edge(p, after[0], "blend", s(after[0]));
  }
  for (const n of nodes.values()) n.sites.sort((a, b) => a.turn - b.turn || a.name.localeCompare(b.name));
  for (const e of edges.values()) e.sites.sort((a, b) => a.turn - b.turn || a.name.localeCompare(b.name));
  const list = [...nodes.values()].sort((a, b) => a.first - b.first || a.tag.localeCompare(b.tag));
  const el = [...edges.values()].sort((a, b) => a.first - b.first || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  layout(list, el);
  return { kind, colonyId, nodes: list, edges: el, turns: [...new Set(list.map((n) => n.first))].sort((a, b) => a - b) };
}

/** Top-to-bottom over time: y = rank of the node's first turn; x = lane (children reuse a parent's lane when free). */
function layout(nodes: LineageNode[], edges: LineageEdge[]): void {
  const turns = [...new Set(nodes.map((n) => n.first))].sort((a, b) => a - b);
  const rank = new Map(turns.map((t, i) => [t, i]));
  const parents = new Map<string, string[]>();
  for (const e of edges) (parents.get(e.to) ?? parents.set(e.to, []).get(e.to)!).push(e.from);
  const byTag = new Map(nodes.map((n) => [n.tag, n]));
  const laneTail: number[] = []; // last rank used per lane
  for (const n of nodes) {
    const r = rank.get(n.first)!;
    let lane = -1;
    for (const p of parents.get(n.tag) ?? []) {
      const pn = byTag.get(p);
      if (pn && pn.first <= n.first && (laneTail[pn.lane] ?? -1) < r) { lane = pn.lane; break; }
    }
    if (lane < 0) { lane = laneTail.findIndex((t) => t < r); if (lane < 0) lane = laneTail.length; }
    laneTail[lane] = r;
    n.lane = lane; n.x = lane; n.y = r;
  }
}
