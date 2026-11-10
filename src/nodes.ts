import type { Body, Colony, NodeType } from "./types.js";

export const NODES: readonly NodeType[] = [
  "Resources","Infrastructure","Water","Oxygen","Food","Energy","Population",
  "Culture","Ideology","Money","Logistics","Science","Production",
  "Military","Stability","Subversion","Terraforming","Thrust","Projects",
] as const;

export const DEPS: Partial<Record<NodeType, readonly NodeType[]>> = {
  Infrastructure: ["Resources"],
  Water: ["Infrastructure"],
  Oxygen: ["Infrastructure"],
  Food: ["Infrastructure"],
  Energy: ["Resources", "Infrastructure"],
  Population: ["Food", "Water"],
  Culture: ["Population"],
  Ideology: ["Population"],
  Money: ["Population", "Production"],
  Logistics: ["Energy", "Money"],
  Science: ["Energy", "Population"],
  Production: ["Resources", "Infrastructure", "Energy", "Population"],
  Projects: ["Science", "Production"],
  Thrust: ["Science", "Production", "Energy", "Resources"],
  Terraforming: ["Resources", "Infrastructure", "Energy", "Production", "Science"],
  Military: ["Science", "Production", "Population", "Ideology", "Stability"],
  Stability: ["Culture", "Ideology", "Military", "Food", "Water"],
  Subversion: ["Population", "Military", "Ideology", "Culture"],
};

export const NODE_COLORS: Record<NodeType, string> = {
  Water: "#3b82f6", Oxygen: "#67e8f9", Food: "#22c55e", Energy: "#eab308", Resources: "#a8a29e",
  Infrastructure: "#64748b", Population: "#ec4899", Culture: "#a855f7",
  Ideology: "#8b5cf6", Money: "#f59e0b", Logistics: "#14b8a6", Science: "#06b6d4",
  Production: "#f97316", Military: "#ef4444", Stability: "#e2e8f0",
  Subversion: "#d946ef", Terraforming: "#84cc16", Thrust: "#38bdf8", Projects: "#6366f1",
};

export function emptyNodes(): Record<NodeType, number> {
  const o = {} as Record<NodeType, number>;
  for (const n of NODES) o[n] = 0;
  return o;
}

export function activeImportCount(c: Colony, n: NodeType): number {
  let t = 0;
  for (const line of c.logisticsLines) {
    // Deprecated Trojan-payload routes on the attacker do not grant clean imports
    if (line.trojanExport || line.route?.trojan) continue;
    // Reverse-logistics Trojan send occupies a line but grants no trade node
    if (line.trojanSend) continue;
    if (line.route && line.route.node === n) t += 1;
    // Bilateral counter inbound (partner consented to send us counterNode)
    if (line.exportRoute?.inboundNode === n) t += 1;
  }
  return t;
}

export function importedLogisticsCount(c: Colony): number {
  return c.logisticsLines.filter((l) => l.kind === "import").length;
}

export function extras(c: Colony, n: NodeType): number {
  let t = (c.specialty === n ? (c.beltRich ? 2 : 1) : 0) + (c.developed[n] || 0) + activeImportCount(c, n);
  if (n === "Logistics") t += importedLogisticsCount(c);
  return t;
}

export function cleanCount(c: Colony, n: NodeType): number {
  let t = (c.specialty === n ? 1 : 0) + activeImportCount(c, n);
  if (n === "Logistics") t += importedLogisticsCount(c);
  return t;
}

/**
 * Cover required for dep `d` from developed type `n`:
 * first developed instance needs 1; each extra beyond the first needs +1.
 * (= developed count when developed >= 1)
 */
export function depCoverRequired(developedCount: number): number {
  if (developedCount <= 0) return 0;
  return developedCount; // 1 + (developedCount - 1)
}

/**
 * Across different developed node types, one source of an input covers all of them
 * (take max requirement per dep). Same-type stacking raises the requirement.
 */
export function stackedDepNeeds(c: Colony): Partial<Record<NodeType, number>> {
  const needed: Partial<Record<NodeType, number>> = {};
  for (const n of NODES) {
    const dCount = c.developed[n] || 0;
    if (dCount <= 0) continue;
    const req = depCoverRequired(dCount);
    for (const d of DEPS[n] || []) {
      needed[d] = Math.max(needed[d] || 0, req);
    }
  }
  return needed;
}

/**
 * Strain: exactly 1 per missing dependency *instance* after stacking.
 * Specialty / clean import / developed extras of a dep all count via extras().
 * Specialty alone covers as 1 clean unit. Clean imports do not create strain.
 * No Stability-special bonus strain.
 */
export function strainOf(c: Colony): number {
  const needed = stackedDepNeeds(c);
  let s = 0;
  for (const d of Object.keys(needed) as NodeType[]) {
    const req = needed[d] || 0;
    const cover = extras(c, d);
    if (cover < req) s += req - cover;
  }
  return s;
}

export function sumExtras(c: Colony): number {
  let t = 0;
  for (const n of NODES) t += extras(c, n);
  return t;
}

export function occupiedLineCount(c: Colony): number {
  return c.logisticsLines.filter(
    (l) => l.route !== null || l.exportRoute != null || l.trojanExport || !!l.trojanSend
  ).length;
}
/** Free import slot: route === null; export may already be set. Lent-away / trojanSend locks the line. */
export function freeLines(c: Colony) {
  return c.logisticsLines.filter((l) => l.route === null && !l.lentTo && !l.trojanSend && !l.relay);
}
export function freeLineCount(c: Colony): number {
  return freeLines(c).length;
}
export function occupiedLines(c: Colony) {
  return c.logisticsLines.filter((l) => l.route !== null);
}
/** Free export slot (0.7.1 two-way). Borrowed lines do not export. */
export function exportFreeLines(c: Colony) {
  return c.logisticsLines.filter(
    (l) =>
      (l.exportRoute == null || l.exportRoute === undefined) &&
      !l.lentTo &&
      !l.trojanExport &&
      !l.trojanSend &&
      l.kind !== "borrowed" &&
      // 0.8.3: one bilateral deal per line — no export while importing from Earth
      l.route?.sourceKind !== "earth"
  );
}

/** Extra logistics lines (specialty / imported / developed works) not lent away. Base never counts. */
export function logisticsRpContribution(c: Colony): number {
  return c.logisticsLines.filter((l) => l.kind !== "base" && l.kind !== "borrowed" && !l.lentTo).length;
}

/**
 * Colony level: specialty counts as tier 1; each developed extra (any node) +1.
 * level = 1 + sum(developed). Fresh specialty colony = Level 1.
 */
export function colonyLevel(c: Colony): number {
  let sum = 0;
  for (const n of NODES) sum += (c.developed[n] || 0);
  return 1 + sum;
}

/**
 * RP node score: specialty (1) unless Logistics (counted via specialty line) +
 * developed extras (non-Logistics) + active clean imports (non-Logistics) +
 * extra logistics lines (specialty / import / develop). Skips developed["Logistics"]
 * because those buildings already add countable lines.
 */
export function rpNodeScore(c: Colony): number {
  let t = 0;
  if (c.specialty && c.specialty !== "Logistics") t += 1;
  for (const n of NODES) {
    if (n === "Logistics") continue;
    t += (c.developed[n] || 0) + activeImportCount(c, n);
  }
  t += logisticsRpContribution(c);
  return t;
}

export function rp(c: Colony, bodyTF: Record<Body, number>): number {
  return c.bodyMod + rpNodeScore(c) + (bodyTF[c.body] || 0) - strainOf(c);
}

export function logiAvail(c: Colony): number { return freeLineCount(c); }
export function logiCap(c: Colony): number { return c.logisticsLines.length; }
export function bodyModFor(_b: Body): number { return 0; }
export function bodyLabel(body: Body): string { return body === "Moon" ? "Lunar" : body === "Belt" ? "Belt" : "Mars"; }
/** Body adjective for colony names: Moon→Lunar, Mars→Martian. */
export function bodyAdj(body: Body): string { return body === "Moon" ? "Lunar" : body === "Belt" ? "Belter" : "Martian"; }

/** Deps of developed node n that are under-covered under stacking rules. */
export function missingDepsOf(c: Colony, n: NodeType): NodeType[] {
  if (n === c.specialty || (c.developed[n] || 0) <= 0) return [];
  const req = depCoverRequired(c.developed[n] || 0);
  return (DEPS[n] || []).filter((d) => extras(c, d) < req);
}

export function strainedNodes(c: Colony): NodeType[] {
  return NODES.filter((n) => (c.developed[n] || 0) > 0 && missingDepsOf(c, n).length > 0);
}

export function freeExcessNodes(c: Colony): NodeType[] {
  return NODES.filter((n) => extras(c, n) > 0 && (n === c.specialty || missingDepsOf(c, n).length === 0));
}
