/**
 * 0.14.0 — Needs tree + supplier menu (read-only analysis of engine state).
 * Uses the engine's own rule helpers (strainOf, stackedDepNeeds, findSources,
 * listMoves …) so nothing here re-implements trade rules. Never mutates G.
 */
import type { Alliance, Body, Colony, EarthBloc, GameState, LogisticsLine, NodeType } from "./types.js";
import { DEPS, NODES, extras, stackedDepNeeds, strainOf, missingDepsOf, freeLines, occupiedLines } from "./nodes.js";
import { BASAL_NODES, isIndependent } from "./l3.js";
import {
  consentsExport, findSources, listMoves, marsEarthless, moveKey, patronAllianceOf,
  rankTradeSource, socialAffinity, tradeSourceKey, type PlayerMove, type TradeSource,
} from "./engine.js";
import { lineCanServeTrade } from "./trade.js";
import { nationColorForColony, nationColorForEarth, sameNation } from "./nation.js";
import type { FlagDesign } from "./flagDesign.js";
import { flagForColony, flagForEarth } from "./flagLineage.js";

/**
 * 0.15.3 needs-tree states (Tiago): specialty (blue), developed (green), imported (yellow),
 * missing (red), possible expansion (grey). 0.15.4: red = direct prerequisite of a developed node
 * that the colony lacks; grey = developable (prereqs present / none); "locked" = prereqs absent.
 */
export type NeedState = "specialty" | "developed" | "imported" | "missing" | "expand" | "locked";

/** Strain the colony would carry if it developed +1 of `n` (pure: works on a copy). */
export function strainIfDeveloped(c: Colony, n: NodeType): number {
  const copy: Colony = { ...c, developed: { ...c.developed, [n]: (c.developed[n] || 0) + 1 } };
  return strainOf(copy);
}

/**
 * Possible no-stress expansions: nodes the colony does not have yet whose
 * development would add no strain (all Requires/deps already covered).
 * Specialty is never developed (engine rule), so it is excluded.
 */
export function noStrainExpansions(c: Colony): NodeType[] {
  const base = strainOf(c);
  return NODES.filter((n) => n !== c.specialty && extras(c, n) <= 0 && strainIfDeveloped(c, n) <= base);
}

/** Missing nodes (red): the Requires gate, under-covered deps (strain), absent basals. */
export function missingNodes(c: Colony): NodeType[] {
  const out = new Set<NodeType>([c.requires]);
  const need = stackedDepNeeds(c);
  for (const d of Object.keys(need) as NodeType[]) if (extras(c, d) < (need[d] || 0)) out.add(d);
  for (const b of BASAL_NODES) if (extras(c, b) <= 0) out.add(b);
  return NODES.filter((n) => out.has(n));
}

/** Longest-path depth in the DEPS graph (Resources = 0). */
export function nodeDepth(n: NodeType, seen: NodeType[] = []): number {
  const deps = (DEPS[n] || []).filter((d) => !seen.includes(d));
  if (!deps.length) return 0;
  return 1 + Math.max(...deps.map((d) => nodeDepth(d, [...seen, n])));
}

export interface TreeNode {
  node: NodeType; state: NeedState; depth: number; deps: NodeType[];
  count: number; source: string; why: string;
  /** Owned but under-covered for what depends on it (counts toward strain). */
  short: boolean;
  /** Owned node that is (also) imported via trade/logistics. */
  imported: number;
}

/**
 * Pure classifier (exported for tests). 0.15.4 (Tiago): red only when a node sits directly below a
 * developed (green) node that needs it and the colony doesn't have it — matching the sim, where only
 * developed nodes create dependency strain. Not red just for being the Requires gate or a basal.
 * Grey = not owned but a basic node, or developable (all prerequisites owned). Locked = the rest.
 */
export function classifyNeed(c: Colony, n: NodeType): NeedState {
  if (n === c.specialty) return "specialty";
  if ((c.developed[n] || 0) > 0) return "developed";
  if (extras(c, n) > 0) return "imported";
  if (neededByDeveloped(c, n).length) return "missing";
  // Basics (Resources, Infrastructure, Energy, Food, Water, Oxygen) are always a possible expansion (Tiago).
  if (BASAL_NODES.includes(n) || (DEPS[n] || []).every((d) => extras(c, d) > 0)) return "expand";
  return "locked";
}

/** Developed nodes that list `n` as a direct prerequisite. */
export function neededByDeveloped(c: Colony, n: NodeType): NodeType[] {
  return NODES.filter((m) => (c.developed[m] || 0) > 0 && (DEPS[m] || []).includes(n));
}

export function needsTree(c: Colony): TreeNode[] {
  const need = stackedDepNeeds(c);
  return NODES.map((n) => {
    const count = extras(c, n);
    const has = count > 0;
    const state = classifyNeed(c, n);
    const src: string[] = [];
    if (c.specialty === n) src.push("specialty");
    if ((c.developed[n] || 0) > 0) src.push(`developed×${c.developed[n]}`);
    const imp = count - (c.specialty === n ? 1 : 0) - (c.developed[n] || 0);
    if (imp > 0) src.push(`imported×${imp}`);
    let why = "";
    if (state === "missing") why = `needed by developed ${neededByDeveloped(c, n).join(", ")} (strain: needs ${need[n] || 1}, has ${count})`;
    else if (state === "expand") why = BASAL_NODES.includes(n) ? "basic — can develop" : "prerequisites present — can develop";
    if (n === c.requires) why = `Requires — importing it develops +1 node${why ? ` · ${why}` : ""}`;
    else if (has) {
      const md = missingDepsOf(c, n);
      why = md.length ? `strained (missing ${md.join(", ")})` : "covered";
    }
    if (!why && state === "locked") why = `locked: develop ${(DEPS[n] || []).filter((d) => extras(c, d) <= 0).join(", ") || "deps"} first`;
    const short = has && (need[n] || 0) > count;
    return { node: n, state, depth: nodeDepth(n), deps: [...(DEPS[n] || [])], count, source: src.join(" + "), why, short, imported: Math.max(0, imp) };
  });
}

// ---------------- Suppliers ----------------

export type Relation = "own" | "ally" | "neutral" | "rival";
export type Location = "Earth" | Body;

export interface Supplier {
  node: NodeType;
  kind: "earth" | "colony";
  id: string;
  name: string;
  location: Location;
  color: string;
  /** Flag key for flagSvg (same identity key as colony cards). */
  flagKey: string;
  /** 0.15.0 flag design. */
  flag: FlagDesign;
  relation: Relation;
  /** Legal now under engine trade rules (findSources). */
  legal: boolean;
  blocks: string[];
  scope: "regional" | "outer";
  line: string;
  replaces: string;
  allyHint: string;
  /** Node category for sorting: 0 = Requires, 1 = missing/vital, 2 = expansion, 3 = other. */
  needRank: number;
  /** Engine rank (lower = engine prefers). */
  engineRank: number;
  /** Move key if the selected colony is acting and a matching legal move exists. */
  moveKey: string | null;
  moveLabel: string | null;
}

const REL_ORDER: Record<Relation, number> = { own: 0, ally: 1, neutral: 2, rival: 3 };

/** Sort: Requires first → logistics feasible → needs → own/ally → neutral → rival → engine rank → name. */
export function compareSuppliers(a: Supplier, b: Supplier): number {
  return (a.needRank === 0 ? 0 : 1) - (b.needRank === 0 ? 0 : 1)
    || Number(b.legal) - Number(a.legal)
    || Number(!!b.moveKey) - Number(!!a.moveKey)
    || a.needRank - b.needRank
    || REL_ORDER[a.relation] - REL_ORDER[b.relation]
    || a.engineRank - b.engineRank
    || a.name.localeCompare(b.name)
    || a.node.localeCompare(b.node);
}

function relationEarth(G: GameState, actor: Colony, bloc: EarthBloc): Relation {
  if (!isIndependent(actor) && bloc.name === actor.patron) return "own";
  if (bloc.alliance === "Neutral") return "neutral";
  const mine = patronAllianceOf(G, actor);
  if (mine === null) return "neutral";
  if (mine === "Neutral") return "neutral";
  return mine === bloc.alliance ? "ally" : "rival";
}

function relationColony(G: GameState, actor: Colony, other: Colony): Relation {
  if (sameNation(actor, other)) return "own";
  const a: Alliance | null = patronAllianceOf(G, actor), b = patronAllianceOf(G, other);
  if (a && b) {
    if (a === "Neutral" || b === "Neutral") return "neutral";
    return a === b ? "ally" : "rival";
  }
  return socialAffinity(G, actor, other) >= 1 ? "ally" : "neutral";
}

function lineText(line: LogisticsLine): string {
  return `${line.name}${line.reach ? ` [${line.reach} reach]` : ""}`;
}

function describeMove(G: GameState, actor: Colony, m: PlayerMove): string {
  if (m.kind === "start") { const l = actor.logisticsLines.find((x) => x.id === m.lineId); return `free import slot on ${l ? lineText(l) : m.lineId}`; }
  if (m.kind === "switch") {
    const l = actor.logisticsLines.find((x) => x.id === m.lineId);
    return `switches ${l ? lineText(l) : m.lineId}`;
  }
  if (m.kind === "start-lend") {
    const lender = G.colonies.find((c) => c.id === m.lenderId);
    return `borrows a line from ${lender?.name ?? m.lenderId} (no free line of its own)`;
  }
  if (m.kind === "import-logistics") return "imports a new logistics line (adds capacity, uses no line)";
  return m.kind;
}

const MOVE_PREF: Record<string, number> = { "import-logistics": 0, start: 1, "start-lend": 2, switch: 3 };

/**
 * Every place that has `node` (or, with node omitted, every missing/expansion node),
 * as cards for the given colony. Info-only unless `actorIsActing` (then moveKey is set).
 */
export function listSuppliers(G: GameState, actor: Colony, node: NodeType | null, actorIsActing: boolean): Supplier[] {
  const miss = missingNodes(actor);
  const grey = noStrainExpansions(actor);
  const nodes: NodeType[] = node ? [node] : [...new Set([...miss, ...grey])];
  const moves = actorIsActing ? listMoves(G, actor) : [];
  const bySource = new Map<string, PlayerMove>();
  for (const m of moves) {
    if (m.kind !== "start" && m.kind !== "switch" && m.kind !== "start-lend" && m.kind !== "import-logistics") continue;
    const k = tradeSourceKey(m.source);
    const prev = bySource.get(k);
    if (!prev || MOVE_PREF[m.kind]! < MOVE_PREF[prev.kind]!) bySource.set(k, m);
  }
  const out: Supplier[] = [];
  for (const n of nodes) {
    const legalKeys = new Set(findSources(G, actor, n).map(tradeSourceKey));
    const needRank = n === actor.requires ? 0 : miss.includes(n) ? 1 : grey.includes(n) ? 2 : 3;
    const current = occupiedLines(actor).find((l) => l.route?.node === n);
    const strained = NODES.filter((x) => (actor.developed[x] || 0) > 0 && missingDepsOf(actor, x).includes(n));
    let replaces: string;
    if (n === actor.requires) replaces = `Fills Requires (${n}) → develops +1 random node and rolls a new Requires`;
    else if (strained.length) replaces = `Removes strain on ${strained.join(", ")} (each import covers 1)`;
    else if (current?.route) replaces = `Adds a 2nd ${n} beside the import from ${current.route.sourceName}`;
    else if ((BASAL_NODES as readonly string[]).includes(n) && extras(actor, n) <= 0) replaces = `Covers missing basal ${n} (survival clocks / fervor)`;
    else replaces = grey.includes(n) ? `New clean ${n}: adds RP, no strain` : `Extra ${n}`;
    const sources: TradeSource[] = [];
    for (const b of G.blocs) {
      const idx = b.excess.findIndex((s) => s.node === n && s.claimedBy === null);
      if (idx >= 0) sources.push({ kind: "earth", bloc: b, node: n, slotIndex: idx });
    }
    for (const c of G.colonies) if (c.id !== actor.id && extras(c, n) >= 1) sources.push({ kind: "colony", colony: c, node: n });
    for (const s of sources) {
      const key = tradeSourceKey(s);
      const legal = legalKeys.has(key);
      const m = bySource.get(key) ?? null;
      const location: Location = s.kind === "earth" ? "Earth" : s.colony.body;
      const scope = location === actor.body ? "regional" : "outer";
      const blocks: string[] = [];
      const anyReach = actor.logisticsLines.some((l) => !l.lentTo && lineCanServeTrade(l, actor, s));
      if (s.kind === "earth" && marsEarthless(G, actor)) blocks.push("Mars trades only with Moon colonies (0.18.0)");
      else if (n !== "Logistics" && !anyReach) {
        blocks.push(location === "Earth" && actor.body === "Mars" ? "Earth→Mars needs an Earth-reach line" : `no line with ${location}→${actor.body} reach`);
      }
      if (s.kind === "colony" && !consentsExport(G, s.colony, actor, n)) blocks.push("supplier will not export to you (rival / low affinity)");
      if (!legal && !blocks.length) blocks.push(s.kind === "earth" ? "East/West trade lock (only vital + fair)" : "no free export line / gated");
      if (legal && actorIsActing && !m) blocks.push("no free line this action (free or switch a line)");
      const free = freeLines(actor).filter((l) => lineCanServeTrade(l, actor, s));
      const line = m ? describeMove(G, actor, m)
        : n === "Logistics" ? "Logistics import adds its own line"
        : free.length ? `would use ${lineText(free[0]!)}` : "needs a free line (switch, borrow or import Logistics)";
      const relation = s.kind === "earth" ? relationEarth(G, actor, s.bloc) : relationColony(G, actor, s.colony);
      let allyHint: string;
      if (s.kind === "earth") {
        allyHint = `${relation === "own" ? "Your patron" : relation === "ally" ? "Allied Earth bloc" : relation === "rival" ? "Rival bloc" : "Neutral bloc"}: claims 1 of its ${s.bloc.excess.filter((x) => x.claimedBy === null).length} free excess slots`;
      } else {
        const spare = extras(s.colony, n);
        allyHint = `${relation === "own" ? "Same nation" : relation === "ally" ? "Ally" : relation === "rival" ? "Rival" : "Neutral"}: uses 1 export leg of ${s.colony.name} (has ${spare} ${n})`;
        if (relation === "own" || relation === "ally") allyHint += " — keeps trade inside your camp";
      }
      out.push({
        node: n, kind: s.kind,
        id: s.kind === "earth" ? s.bloc.name : s.colony.id,
        name: s.kind === "earth" ? s.bloc.name : s.colony.name,
        location,
        color: s.kind === "earth" ? (s.bloc.nationColor || nationColorForEarth(s.bloc.name)) : nationColorForColony(s.colony),
        flagKey: s.kind === "earth" ? s.bloc.name : `${s.colony.name}|${s.colony.culture.join("/")}|${s.colony.ideology[0] || ""}`,
        flag: s.kind === "earth" ? flagForEarth(s.bloc.name) : flagForColony(G, s.colony),
        relation, legal, blocks, scope, line, replaces, allyHint, needRank,
        engineRank: rankTradeSource(G, actor, s),
        moveKey: m ? moveKey(m) : null,
        moveLabel: m ? (m.kind === "switch" ? "Switch" : m.kind === "start-lend" ? "Borrow + import" : "Import") : null,
      });
    }
  }
  return out.sort(compareSuppliers);
}

