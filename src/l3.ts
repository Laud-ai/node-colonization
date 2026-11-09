import { extraFervor } from "./fervorHooks.js";
/**
 * L3 — Fervor ledger, revolution, Independent founding, Trojan send.
 * 0.9.1: configurable FervorParams; Subversion import/develop no longer marks importer.
 */
import type { Rng } from "./rng.js";
import {
  extras, freeLines, strainOf, rp, NODES, DEPS, missingDepsOf, strainedNodes,
} from "./nodes.js";
import type {
  Body, Colony, EarthBloc, GameState, LogisticsLine, NodeType,
} from "./types.js";

/** Default independence threshold (0.9.1 — raised after fervor sweep; was 5). */
export const FERVOR_THRESHOLD = 10;

/**
 * Tunable fervor ledger weights and gates (0.9.1).
 * Positive weights add when the condition holds; loyalty weights subtract.
 * Missing-basal weight is per basal, optionally capped via missingBasalCap (0 = uncapped).
 */
export interface FervorParams {
  threshold: number;
  wSubversionMark: number;
  wMissingBasal: number;
  missingBasalCap: number;
  wCultureMisalign: number;
  wIdeologyMisalign: number;
  wLowRp: number;
  wHighStrain: number;
  wUnfairExtraction: number;
  wAllianceLockout: number;
  wSurvivalFailure: number;
  wSolarHegemony: number;
  wCultureAlign: number;
  wIdeologyAlign: number;
  wBlocTrade: number;
  wConsentingTrade: number;
  wHighRp: number;
  wVitalImport: number;
  wDependenceLoyalty: number;
  wPowerStick: number;
  wYoungLoyalty: number;
  minAgeTurns: number;
  youngAgeTurns: number;
  lowRpAtOrBelow: number;
  highRpAtOrAbove: number;
  strainAtOrAbove: number;
  powerStickMargin: number;
  solarHegemonyAfterTurn: number;
  solarHegemonyMinRp: number;
  /** +1 fervor per agePressureStep turns of age, capped at agePressureCap (slow ferment). */
  agePressureStep: number;
  agePressureCap: number;
  wAgePressure: number;
}

/** Shipped baseline (realistic survival package) — see NOTES-0.9.1.md. */
export const DEFAULT_FERVOR_PARAMS: FervorParams = {
  threshold: FERVOR_THRESHOLD,
  wSubversionMark: 1,
  wMissingBasal: 1,
  missingBasalCap: 3,
  wCultureMisalign: 1,
  wIdeologyMisalign: 1,
  wLowRp: 0, // young/weak = loyalty via young/dependence, not +fervor
  wHighStrain: 2,
  wUnfairExtraction: 2,
  wAllianceLockout: 2,
  wSurvivalFailure: 2,
  wSolarHegemony: 3,
  wCultureAlign: 1,
  wIdeologyAlign: 1,
  wBlocTrade: 1,
  wConsentingTrade: 1,
  wHighRp: 0, // power-stick handles suzerain gravity; don't suppress strong solar
  wVitalImport: 1,
  wDependenceLoyalty: 2,
  wPowerStick: 2,
  wYoungLoyalty: 3,
  minAgeTurns: 15,
  youngAgeTurns: 12,
  lowRpAtOrBelow: 1,
  highRpAtOrAbove: 5,
  strainAtOrAbove: 3,
  powerStickMargin: 4,
  solarHegemonyAfterTurn: 45,
  solarHegemonyMinRp: 5,
  agePressureStep: 20,
  agePressureCap: 3,
  wAgePressure: 1,
};

/** 0.8.3 / 0.9.0 control: threshold 5, bare ±1, uncapped basals, no new drivers. */
export const LEGACY_FERVOR_PARAMS: FervorParams = {
  threshold: 5,
  wSubversionMark: 1,
  wMissingBasal: 1,
  missingBasalCap: 0,
  wCultureMisalign: 1,
  wIdeologyMisalign: 1,
  wLowRp: 1,
  wHighStrain: 1,
  wUnfairExtraction: 1,
  wAllianceLockout: 0,
  wSurvivalFailure: 0,
  wSolarHegemony: 0,
  wCultureAlign: 1,
  wIdeologyAlign: 1,
  wBlocTrade: 1,
  wConsentingTrade: 1,
  wHighRp: 1,
  wVitalImport: 1,
  wDependenceLoyalty: 0,
  wPowerStick: 0,
  wYoungLoyalty: 0,
  minAgeTurns: 0,
  youngAgeTurns: 0,
  lowRpAtOrBelow: 1,
  highRpAtOrAbove: 5,
  strainAtOrAbove: 3,
  powerStickMargin: 4,
  solarHegemonyAfterTurn: 999,
  solarHegemonyMinRp: 99,
  agePressureStep: 0,
  agePressureCap: 0,
  wAgePressure: 0,
};

export function fervorParamsOf(G: GameState): FervorParams {
  const base: FervorParams = { ...DEFAULT_FERVOR_PARAMS };
  const over = G.fervorParams;
  if (over) {
    for (const [k, v] of Object.entries(over)) {
      if (typeof v === "number" && Number.isFinite(v) && k in base) {
        (base as unknown as Record<string, number>)[k] = v;
      }
    }
  }
  const t = G.independenceThreshold;
  if (typeof t === "number" && Number.isFinite(t) && t >= 1) {
    base.threshold = Math.floor(t);
  }
  return base;
}

/** Apply full/partial FervorParams; syncs G.independenceThreshold. */
export function applyFervorParams(G: GameState, params: Partial<FervorParams>): FervorParams {
  const merged: FervorParams = { ...DEFAULT_FERVOR_PARAMS, ...(G.fervorParams as Partial<FervorParams> | undefined), ...params };
  G.fervorParams = { ...merged };
  G.independenceThreshold = Math.max(1, Math.floor(merged.threshold));
  return fervorParamsOf(G);
}

/** Effective independence threshold (G.independenceThreshold / fervorParams). */
export function independenceThresholdOf(G: GameState): number {
  return fervorParamsOf(G).threshold;
}

/** @deprecated 0.8.3 — missing basals are each +1 uncapped in the legacy ledger. */
export const MISSING_BASAL_FERVOR_CAP = 6;

/** Basal nodes for QoL / missing-basal fervor (Oxygen counts as basal). */
export const BASAL_NODES: readonly NodeType[] = [
  "Resources", "Infrastructure", "Energy", "Food", "Water", "Oxygen",
] as const;

export const INDEPENDENT_PATRON = "Independent";

export type L3TradeSource =
  | { kind: "earth"; bloc: EarthBloc; node: NodeType; slotIndex: number }
  | { kind: "colony"; colony: Colony; node: NodeType };

/** Minimal engine deps injected to avoid circular imports. */
export interface L3Deps {
  pushLog: (G: GameState, msg: string, imp?: boolean) => void;
  CULTURES: Record<string, string>;
  IDEOLOGIES: Record<string, string>;
  blocByName: (G: GameState, name: string) => EarthBloc | undefined;
  releaseEarthClaim: (G: GameState, b: EarthBloc, slotIndex: number, rng: Rng, actorName: string) => void;
  makeColony: (G: GameState, cfg: {
    patron: string; body: Body; specialty: NodeType; requires: NodeType;
    culture: string[]; ideology: string[]; name?: string; liegeId?: string | null;
    rng?: Rng;
  }) => Colony;
  rollSpecialtyRequires: (rng: Rng, mode: GameState["gameMode"]) => { specialty: NodeType; requires: NodeType };
  findSources: (G: GameState, actor: Colony, node: NodeType) => L3TradeSource[];
  socialAffinity: (G: GameState, a: Colony, b: Colony) => number;
  findLine: (c: Colony, lineId: string) => LogisticsLine | undefined;
  returnLentLine: (G: GameState, borrower: Colony, borrowedLineId: string) => boolean;
  clearRouteOnLine: (G: GameState, actor: Colony, line: LogisticsLine, rng: Rng, silent?: boolean) => void;
  /** Grant a clean colony→colony import without marking acted. */
  grantColonyImport: (
    G: GameState, recipient: Colony, lineId: string, donor: Colony, node: NodeType, rng: Rng,
    donorExportLineId?: string
  ) => boolean;
  isFriendlyEarthBloc?: (G: GameState, actor: Colony, bloc: EarthBloc) => boolean;
  /** 0.8.2 founding cooldown (shared with Earth). */
  foundingCooldownReady?: (G: GameState) => boolean;
  /** 0.8.2 Mars lunar gate body pick. */
  pickFoundingBody?: (G: GameState, patron: string, liegeId?: string | null) => Body;
}

let D: L3Deps | null = null;

export function bindL3(deps: L3Deps): void {
  D = deps;
}
function deps(): L3Deps {
  if (!D) throw new Error("L3 not bound — call bindL3 from engine");
  return D;
}

export function isIndependent(c: Colony): boolean {
  return c.patron === INDEPENDENT_PATRON;
}

/** Same Earth patron, or both Independent with same liegeId root. */
export function sameBloc(a: Colony, b: Colony): boolean {
  if (a.patron === INDEPENDENT_PATRON && b.patron === INDEPENDENT_PATRON) {
    return !!a.liegeId && a.liegeId === b.liegeId;
  }
  return a.patron === b.patron && a.patron !== INDEPENDENT_PATRON;
}

/** Missing basal nodes (extras===0). */
export function missingBasals(c: Colony): NodeType[] {
  return BASAL_NODES.filter((n) => extras(c, n) <= 0);
}

export function cultureMisalignedWithPatron(c: Colony): boolean {
  if (isIndependent(c)) return false;
  const tag = deps().CULTURES[c.patron];
  if (!tag) return true;
  return !c.culture.includes(tag);
}

export function ideologyMisalignedWithPatron(c: Colony): boolean {
  if (isIndependent(c)) return false;
  const gov = deps().IDEOLOGIES[c.patron];
  if (!gov) return true;
  const all = new Set([...c.ideology, ...c.ideologyImported]);
  return !all.has(gov);
}

/** Active import / logistics from Earth patron bloc or same-patron colonies. */
export function importsFromPatronNetwork(G: GameState, c: Colony): boolean {
  if (isIndependent(c)) return false;
  for (const line of c.logisticsLines) {
    const r = line.route;
    if (r) {
      if (r.sourceKind === "earth" && r.sourceId === c.patron) return true;
      if (r.sourceKind === "colony") {
        const src = G.colonies.find((x) => x.id === r.sourceId);
        if (src && src.patron === c.patron) return true;
      }
    }
    if (line.kind === "import") {
      if (line.earthClaim?.blocName === c.patron) return true;
      if (line.colonySourceId) {
        const src = G.colonies.find((x) => x.id === line.colonySourceId);
        if (src && src.patron === c.patron) return true;
      }
    }
  }
  return false;
}

/**
 * Would a link between c and other be severed on c's revolution
 * (same former Earth patron only — not whole alliance).
 */
export function wouldSeverOnRevolution(c: Colony, other: Colony, formerPatron: string): boolean {
  if (other.id === c.id) return false;
  return other.patron === formerPatron;
}

export function wouldSeverEarthBloc(formerPatron: string, blocName: string): boolean {
  return blocName === formerPatron;
}

/** Count active routes/claims/lends that would sever on revolution vs former patron. */
export function severableLinkCount(G: GameState, c: Colony): number {
  if (isIndependent(c)) return 0;
  const former = c.patron;
  let n = 0;
  for (const line of c.logisticsLines) {
    if (line.route) {
      const r = line.route;
      if (r.sourceKind === "earth" && wouldSeverEarthBloc(former, r.sourceId)) n += 1;
      else if (r.sourceKind === "colony") {
        const src = G.colonies.find((x) => x.id === r.sourceId);
        if (src && wouldSeverOnRevolution(c, src, former)) n += 1;
      }
    }
    if (line.kind === "import") {
      if (line.earthClaim && wouldSeverEarthBloc(former, line.earthClaim.blocName)) n += 1;
      if (line.colonySourceId) {
        const src = G.colonies.find((x) => x.id === line.colonySourceId);
        if (src && wouldSeverOnRevolution(c, src, former)) n += 1;
      }
    }
    if (line.lentTo) {
      const borrower = G.colonies.find((x) => x.id === line.lentTo);
      if (borrower && wouldSeverOnRevolution(c, borrower, former)) n += 1;
    }
    if (line.borrowedFrom) {
      const lender = G.colonies.find((x) => x.id === line.borrowedFrom!.colonyId);
      if (lender && wouldSeverOnRevolution(c, lender, former)) n += 1;
    }
  }
  for (const other of G.colonies) {
    if (other.id === c.id) continue;
    if (other.patron !== former) continue;
    for (const line of other.logisticsLines) {
      if (line.route?.sourceKind === "colony" && line.route.sourceId === c.id) n += 1;
      if (line.kind === "import" && line.colonySourceId === c.id) n += 1;
      if (line.lentTo === c.id) n += 1;
      if (line.borrowedFrom?.colonyId === c.id) n += 1;
    }
  }
  const bloc = deps().blocByName(G, former);
  if (bloc) {
    for (const s of bloc.excess) {
      if (s.claimedBy === c.id) n += 1;
    }
  }
  return n;
}

/** Basals covered locally (specialty / developed / non-patron-network imports). */
export function localBasalCoverage(G: GameState, c: Colony): number {
  let covered = 0;
  for (const n of BASAL_NODES) {
    const local = (c.specialty === n ? 1 : 0) + (c.developed[n] || 0);
    let cleanLocalImports = 0;
    for (const line of c.logisticsLines) {
      if (!line.route || line.route.node !== n) continue;
      const r = line.route;
      if (r.sourceKind === "earth" && r.sourceId === c.patron) continue;
      if (r.sourceKind === "colony") {
        const src = G.colonies.find((x) => x.id === r.sourceId);
        if (src && src.patron === c.patron) continue;
      }
      cleanLocalImports += 1;
    }
    if (local + cleanLocalImports > 0) covered += 1;
  }
  return covered;
}

export function exitSafetyHigh(G: GameState, c: Colony): boolean {
  const severable = severableLinkCount(G, c);
  const local = localBasalCoverage(G, c);
  return severable <= 1 && local >= 4;
}

export function heavilyOnSovereignNetwork(G: GameState, c: Colony): boolean {
  return importsFromPatronNetwork(G, c) && severableLinkCount(G, c) >= 3;
}

/**
 * Active trade with own bloc / liege / patron Earth (fervor −1 term).
 */
export function hasActiveBlocOrLiegeTrade(G: GameState, c: Colony): boolean {
  if (isIndependent(c)) {
    for (const line of c.logisticsLines) {
      if (line.route?.sourceKind === "colony") {
        const src = G.colonies.find((x) => x.id === line.route!.sourceId);
        if (src && sameBloc(c, src)) return true;
      }
      if (line.exportRoute) {
        const imp = G.colonies.find((x) => x.id === line.exportRoute!.colonyId);
        if (imp && sameBloc(c, imp)) return true;
      }
    }
    return false;
  }
  for (const line of c.logisticsLines) {
    const r = line.route;
    if (r) {
      if (r.sourceKind === "earth" && r.sourceId === c.patron) return true;
      if (r.sourceKind === "colony") {
        const src = G.colonies.find((x) => x.id === r.sourceId);
        if (src && (src.patron === c.patron || sameBloc(c, src))) return true;
      }
    }
    if (line.exportRoute) {
      const imp = G.colonies.find((x) => x.id === line.exportRoute!.colonyId);
      if (imp && (imp.patron === c.patron || sameBloc(c, imp))) return true;
    }
  }
  return importsFromPatronNetwork(G, c);
}

/**
 * Active colony↔colony trade with a consenting affinity≥2 (or Neutral/same-alliance) partner.
 */
export function hasActiveConsentingColonyTrade(G: GameState, c: Colony): boolean {
  const d = deps();
  for (const line of c.logisticsLines) {
    if (line.route?.sourceKind === "colony") {
      const src = G.colonies.find((x) => x.id === line.route!.sourceId);
      if (!src) continue;
      if (sameBloc(c, src)) continue; // counted under bloc/liege term
      const aff = d.socialAffinity(G, c, src);
      if (aff >= 2) return true;
    }
    if (line.exportRoute && !line.trojanExport && !line.trojanSend) {
      const imp = G.colonies.find((x) => x.id === line.exportRoute!.colonyId);
      if (!imp || sameBloc(c, imp)) continue;
      if (d.socialAffinity(G, c, imp) >= 2) return true;
    }
  }
  return false;
}

export function hasVitalImport(G: GameState, c: Colony): boolean {
  for (const line of c.logisticsLines) {
    if (line.route?.vital) return true;
    if (line.route && nodeFixesHardIssue(c, line.route.node)) return true;
  }
  return false;
}

/** Colony age in turns (foundedTurn defaults to 1 for starters). */
export function colonyAgeTurns(G: GameState, c: Colony): number {
  const founded = typeof c.foundedTurn === "number" ? c.foundedTurn : 1;
  return Math.max(0, G.turn - founded);
}

/** Same-Earth-patron nation RP (sum of member colony RP) — avoids importing nation.ts. */
function earthPatronNationRp(G: GameState, patron: string): number {
  let s = 0;
  for (const x of G.colonies) {
    if (x.patron === patron) s += rp(x, G.bodyTF);
  }
  return s;
}

/**
 * Alliance/affinity trade lockout: missing a basal that a non-tradeable rival holds.
 */
export function hasAllianceTradeLockout(G: GameState, c: Colony): boolean {
  const missing = missingBasals(c);
  if (!missing.length) return false;
  if (hasActiveConsentingColonyTrade(G, c)) return false;
  const d = deps();
  for (const other of G.colonies) {
    if (other.id === c.id || sameBloc(c, other)) continue;
    const holds = missing.some((n) => extras(other, n) >= 1);
    if (!holds) continue;
    // Mirror colonyTradeOk loosely: Neutral patrons trade freely — skip those
    const aInd = isIndependent(c);
    const bInd = isIndependent(other);
    const aAll = aInd ? null : d.blocByName(G, c.patron)?.alliance ?? null;
    const bAll = bInd ? null : d.blocByName(G, other.patron)?.alliance ?? null;
    if (aAll === "Neutral" || bAll === "Neutral") continue;
    if (aAll && bAll && aAll === bAll) continue;
    if (d.socialAffinity(G, c, other) >= 2) continue;
    return true; // rival has what we need but gate blocks
  }
  return false;
}

export function hasSurvivalFailurePressure(c: Colony): boolean {
  return (c.foodClock || 0) >= 2 || (c.waterClock || 0) >= 2 ||
    (c.oxygenClock || 0) >= 2 || (c.populationStress || 0) >= 1;
}

export function hasSolarHegemonyPressure(G: GameState, c: Colony, P: FervorParams): boolean {
  if (G.turn < P.solarHegemonyAfterTurn) return false;
  if (c.body !== "Moon" && c.body !== "Mars") return false;
  const myRp = rp(c, G.bodyTF);
  if (myRp < P.solarHegemonyMinRp) return false;
  // Stronger than a typical Earth-subject peer average in same patron, or high absolute RP
  const peers = G.colonies.filter((x) => x.patron === c.patron && x.id !== c.id);
  if (!peers.length) return myRp >= P.solarHegemonyMinRp;
  const peerAvg = peers.reduce((s, x) => s + rp(x, G.bodyTF), 0) / peers.length;
  return myRp >= peerAvg + 2 || myRp >= P.solarHegemonyMinRp + 2;
}

/**
 * Fervor ledger: weighted sum of terms each tick (0.9.1 FervorParams).
 * Independents skip (hold 0). Negative sums allowed as “loyal”; revolt uses ≥ threshold.
 */
export function computeFervorLedger(G: GameState, c: Colony): number {
  if (isIndependent(c)) return 0;
  const P = fervorParamsOf(G);
  let s = 0;

  if (c.subversionMark) s += P.wSubversionMark;

  const missing = missingBasals(c);
  let basalTerm = missing.length * P.wMissingBasal;
  if (P.missingBasalCap > 0) basalTerm = Math.min(basalTerm, P.missingBasalCap);
  s += basalTerm;

  if (cultureMisalignedWithPatron(c)) s += P.wCultureMisalign;
  if (ideologyMisalignedWithPatron(c)) s += P.wIdeologyMisalign;

  const myRp = rp(c, G.bodyTF);
  if (myRp <= P.lowRpAtOrBelow) s += P.wLowRp;
  if (strainOf(c) >= P.strainAtOrAbove) s += P.wHighStrain;

  let exportCount = 0;
  for (const line of c.logisticsLines) {
    if (!line.exportRoute || line.trojanSend) continue;
    const imp = G.colonies.find((x) => x.id === line.exportRoute!.colonyId);
    if (imp && (sameBloc(c, imp) || imp.patron === c.patron)) exportCount += 1;
  }
  if (exportCount >= 1 && missing.length >= 2) s += P.wUnfairExtraction;

  if (P.wAllianceLockout && hasAllianceTradeLockout(G, c)) s += P.wAllianceLockout;
  if (P.wSurvivalFailure && hasSurvivalFailurePressure(c)) s += P.wSurvivalFailure;
  if (P.wSolarHegemony && hasSolarHegemonyPressure(G, c, P)) s += P.wSolarHegemony;

  if (!cultureMisalignedWithPatron(c)) s -= P.wCultureAlign;
  if (!ideologyMisalignedWithPatron(c)) s -= P.wIdeologyAlign;
  if (hasActiveBlocOrLiegeTrade(G, c)) s -= P.wBlocTrade;
  if (hasActiveConsentingColonyTrade(G, c)) s -= P.wConsentingTrade;
  if (myRp >= P.highRpAtOrAbove) s -= P.wHighRp;
  if (hasVitalImport(G, c)) s -= P.wVitalImport;

  if (P.wDependenceLoyalty && heavilyOnSovereignNetwork(G, c)) s -= P.wDependenceLoyalty;
  if (P.wPowerStick) {
    const nationRp = earthPatronNationRp(G, c.patron);
    if (nationRp - myRp >= P.powerStickMargin) s -= P.wPowerStick;
  }
  if (P.wYoungLoyalty && colonyAgeTurns(G, c) < P.youngAgeTurns) s -= P.wYoungLoyalty;

  if (P.wAgePressure && P.agePressureStep > 0) {
    const age = colonyAgeTurns(G, c);
    const steps = Math.floor(age / P.agePressureStep);
    const capped = P.agePressureCap > 0 ? Math.min(steps, P.agePressureCap) : steps;
    s += capped * P.wAgePressure;
  }

  s += extraFervor(G, c);
  return s;
}

/**
 * Recompute fervor ledger; revolt when sum ≥ threshold and minAgeTurns satisfied.
 * Independents skip. Returns whether revolution was triggered.
 */
export function tickFervor(G: GameState, c: Colony, rng: Rng): boolean {
  if (isIndependent(c)) {
    return false;
  }
  const P = fervorParamsOf(G);
  c.fervor = computeFervorLedger(G, c);
  if (colonyAgeTurns(G, c) < P.minAgeTurns) return false;
  if (c.fervor >= P.threshold) {
    return maybeRevolution(G, c, rng);
  }
  return false;
}

/** @deprecated 0.8.3 — independence is fervor sum ≥ threshold only. */
export function independenceScore(G: GameState, c: Colony): number {
  return computeFervorLedger(G, c);
}

/** Threshold + minAgeTurns gate. */
export function canAttemptRevolution(G: GameState, c: Colony): boolean {
  if (isIndependent(c)) return false;
  const P = fervorParamsOf(G);
  if (colonyAgeTurns(G, c) < P.minAgeTurns) return false;
  return (c.fervor || 0) >= P.threshold;
}

export function maybeRevolution(G: GameState, c: Colony, rng: Rng): boolean {
  if (!canAttemptRevolution(G, c)) return false;
  executeRevolution(G, c, rng);
  return true;
}

export function executeRevolution(G: GameState, c: Colony, rng: Rng): void {
  const d = deps();
  const formerPatron = c.patron;
  d.pushLog(
    G,
    `⚑ REVOLUTION: ${c.name} breaks from ${formerPatron}! (fervor ${c.fervor})`,
    true
  );
  G.turnAnnouncements.push(`${c.name} revolts from ${formerPatron} — now Independent.`);

  severPatronLinks(G, c, formerPatron, rng);

  c.patron = INDEPENDENT_PATRON;
  c.liegeId = c.id;
  c.fervor = 0;
  d.pushLog(G, `${c.name} is now Independent (liege=${c.id}).`, true);
}

function severPatronLinks(G: GameState, c: Colony, formerPatron: string, rng: Rng): void {
  const d = deps();

  for (const line of [...c.logisticsLines]) {
    if (line.route) {
      const r = line.route;
      let sever = false;
      if (r.sourceKind === "earth" && wouldSeverEarthBloc(formerPatron, r.sourceId)) sever = true;
      if (r.sourceKind === "colony") {
        const src = G.colonies.find((x) => x.id === r.sourceId);
        if (src && wouldSeverOnRevolution(c, src, formerPatron)) sever = true;
      }
      if (sever) d.clearRouteOnLine(G, c, line, rng, false);
    }
  }

  for (let i = c.logisticsLines.length - 1; i >= 0; i--) {
    const line = c.logisticsLines[i]!;
    if (line.kind !== "import") continue;
    let sever = false;
    if (line.earthClaim && wouldSeverEarthBloc(formerPatron, line.earthClaim.blocName)) sever = true;
    if (line.colonySourceId) {
      const src = G.colonies.find((x) => x.id === line.colonySourceId);
      if (src && wouldSeverOnRevolution(c, src, formerPatron)) sever = true;
    }
    if (sever) {
      if (line.route) d.clearRouteOnLine(G, c, line, rng, true);
      if (line.earthClaim) {
        const b = d.blocByName(G, line.earthClaim.blocName);
        if (b) d.releaseEarthClaim(G, b, line.earthClaim.slotIndex, rng, c.name);
      }
      d.pushLog(G, `${c.name} severs ${line.name} in revolution.`, true);
      c.logisticsLines.splice(i, 1);
    }
  }

  for (const line of [...c.logisticsLines]) {
    if (line.kind === "borrowed" && line.borrowedFrom) {
      const lender = G.colonies.find((x) => x.id === line.borrowedFrom!.colonyId);
      if (lender && wouldSeverOnRevolution(c, lender, formerPatron)) {
        if (line.route) d.clearRouteOnLine(G, c, line, rng, true);
        d.returnLentLine(G, c, line.id);
      }
    }
    if (line.lentTo) {
      const borrower = G.colonies.find((x) => x.id === line.lentTo);
      if (borrower && wouldSeverOnRevolution(c, borrower, formerPatron)) {
        const borrowed = borrower.logisticsLines.find(
          (l) =>
            l.kind === "borrowed" &&
            l.borrowedFrom?.colonyId === c.id &&
            l.borrowedFrom.lineId === line.id
        );
        if (borrowed) {
          if (borrowed.route) d.clearRouteOnLine(G, borrower, borrowed, rng, true);
          d.returnLentLine(G, borrower, borrowed.id);
        } else {
          line.lentTo = null;
        }
      }
    }
  }

  for (const other of G.colonies) {
    if (other.id === c.id) continue;
    if (other.patron !== formerPatron) continue;
    for (const line of [...other.logisticsLines]) {
      if (line.route?.sourceKind === "colony" && line.route.sourceId === c.id) {
        d.clearRouteOnLine(G, other, line, rng, false);
      }
      if (line.kind === "import" && line.colonySourceId === c.id) {
        if (line.route) d.clearRouteOnLine(G, other, line, rng, true);
        const idx = other.logisticsLines.indexOf(line);
        if (idx >= 0) {
          d.pushLog(G, `${other.name} loses ${line.name} (revolution severance).`, true);
          other.logisticsLines.splice(idx, 1);
        }
      }
      if (line.lentTo === c.id) {
        const borrowed = c.logisticsLines.find(
          (l) => l.kind === "borrowed" && l.borrowedFrom?.colonyId === other.id
        );
        if (borrowed) {
          if (borrowed.route) d.clearRouteOnLine(G, c, borrowed, rng, true);
          d.returnLentLine(G, c, borrowed.id);
        } else {
          line.lentTo = null;
        }
      }
    }
  }

  const bloc = d.blocByName(G, formerPatron);
  if (bloc) {
    for (let i = 0; i < bloc.excess.length; i++) {
      if (bloc.excess[i]!.claimedBy === c.id) {
        d.releaseEarthClaim(G, bloc, i, rng, c.name);
      }
    }
  }
}

/** Free own non-base, non-borrowed logistics lines (Independent founding currency). */
export function freeOwnNonBaseLines(c: Colony): LogisticsLine[] {
  return c.logisticsLines.filter(
    (l) =>
      l.kind !== "base" &&
      l.kind !== "borrowed" &&
      l.route === null &&
      !l.lentTo &&
      !l.trojanExport &&
      !l.trojanSend
  );
}

export function canIndependentFound(c: Colony): boolean {
  return isIndependent(c) && freeOwnNonBaseLines(c).length >= 1;
}

export function payIndependentFoundingCost(G: GameState, founder: Colony): LogisticsLine | null {
  const free = freeOwnNonBaseLines(founder);
  if (!free.length) return null;
  const order = ["import", "develop", "specialty"] as const;
  let pick: LogisticsLine | undefined;
  for (const k of order) {
    pick = free.find((l) => l.kind === k);
    if (pick) break;
  }
  pick = pick ?? free[0]!;
  const idx = founder.logisticsLines.findIndex((l) => l.id === pick!.id);
  if (idx < 0) return null;
  founder.logisticsLines.splice(idx, 1);
  deps().pushLog(G, `${founder.name} spends ${pick.name} to found a colony.`, true);
  return pick;
}

export function tryIndependentFound(G: GameState, founder: Colony, rng: Rng): boolean {
  if (!canIndependentFound(founder)) return false;
  const d = deps();
  // 0.8.2: shared founding cooldown (0 = every turn)
  if (d.foundingCooldownReady) {
    if (!d.foundingCooldownReady(G)) return false;
  } else {
    const last = G.lastFoundTurn ?? -999;
    if (G.turn - last < 0) return false;
  }
  const paid = payIndependentFoundingCost(G, founder);
  if (!paid) return false;

  if (!founder.liegeId) founder.liegeId = founder.id;
  const liegeId = founder.liegeId;
  // 0.8.2: Mars gate via lunar basis; prefer Moon until gate opens
  const body: Body = d.pickFoundingBody
    ? d.pickFoundingBody(G, INDEPENDENT_PATRON, liegeId)
    : "Moon";
  const { specialty, requires } = d.rollSpecialtyRequires(rng, G.gameMode);

  const col = d.makeColony(G, {
    patron: INDEPENDENT_PATRON,
    body,
    specialty,
    requires,
    culture: founder.culture.slice(),
    ideology: founder.ideology.slice(),
    liegeId,
    rng,
  });
  G.colonies.push(col);
  G.lastFoundTurn = G.turn;
  d.pushLog(
    G,
    `${founder.name} founds Independent colony ${col.name} on ${body} [${specialty}, needs ${requires}] (liege=${liegeId}).`,
    true
  );
  G.pendingFoundings.push({
    patron: INDEPENDENT_PATRON,
    colonyName: col.name,
    body,
    turn: G.turn,
  });
  founder.acted = true;
  return true;
}

/** Node fixes Requires or a critical missing/strained basal / dep. */
export function nodeFixesHardIssue(c: Colony, node: NodeType): boolean {
  if (node === c.requires) return true;
  if ((BASAL_NODES as readonly string[]).includes(node) && extras(c, node) <= 0) return true;
  for (const n of strainedNodes(c)) {
    if (missingDepsOf(c, n).includes(node)) return true;
  }
  return false;
}

/**
 * Friend source exists: Earth (friendly), or colony trade-ok partner (0.8.3).
 * Uses raw availability (not findSources) to avoid Subversion↔trojanAcceptance recursion.
 */
export function hasFriendlySource(G: GameState, victim: Colony, node: NodeType): boolean {
  const d = deps();
  // Earth: any friendly Neutral / same-alliance / Independent-affinity bloc with free excess
  for (const b of G.blocs) {
    const idx = b.excess.findIndex((s) => s.node === node && s.claimedBy === null);
    if (idx < 0) continue;
    if (d.isFriendlyEarthBloc) {
      if (d.isFriendlyEarthBloc(G, victim, b)) return true;
    } else if (b.alliance === "Neutral") {
      return true;
    }
  }
  // Colony partners that would pass trade gate (sameBloc / Neutral / same alliance / aff≥2)
  for (const c of G.colonies) {
    if (c.id === victim.id) continue;
    if (extras(c, node) < 1) continue;
    if (sameBloc(victim, c)) return true;
    // Mirror colonyTradeOk without importing engine:
    const aInd = isIndependent(victim);
    const bInd = isIndependent(c);
    const aAll = aInd ? null : d.blocByName(G, victim.patron)?.alliance ?? null;
    const bAll = bInd ? null : d.blocByName(G, c.patron)?.alliance ?? null;
    if (aAll === "Neutral" || bAll === "Neutral") return true;
    if (aAll && bAll && aAll === bAll) return true; // Neutral already returned above
    if (d.socialAffinity(G, victim, c) >= 2) return true;
  }
  return false;
}

export function trojanAcceptanceGate(G: GameState, victim: Colony, node: NodeType): boolean {
  // Kept for tests / desperation checks — Trojans no longer deliver trade nodes (0.8.3).
  if (!nodeFixesHardIssue(victim, node)) return false;
  if (hasFriendlySource(G, victim, node)) return false;
  return true;
}

export function attackerHasSubversion(c: Colony): boolean {
  return extras(c, "Subversion") >= 1;
}

/** Free own line usable for reverse-logistics Trojan send. */
export function trojanSendFreeLines(c: Colony): LogisticsLine[] {
  return c.logisticsLines.filter(
    (l) =>
      l.kind !== "borrowed" &&
      !l.lentTo &&
      !l.trojanExport &&
      !l.trojanSend &&
      l.route === null &&
      (l.exportRoute == null || l.exportRoute === undefined)
  );
}

/**
 * 0.8.3 Trojan = send Subversion via reverse logistics.
 * Only vs affinity ≤ 1 and not same bloc; does not grant a trade node.
 */
export function canSendTrojan(G: GameState, attacker: Colony, victim: Colony): boolean {
  if (attacker.id === victim.id) return false;
  if (sameBloc(attacker, victim)) return false;
  const aff = deps().socialAffinity(G, attacker, victim);
  if (aff > 1) return false; // only enemies / non-friends (aff ≤ 1)
  if (!attackerHasSubversion(attacker)) return false;
  if (!trojanSendFreeLines(attacker).length) return false;
  return true;
}

/** @deprecated alias — old trade-payload Trojan. */
export function canOfferTrojan(
  G: GameState, attacker: Colony, victim: Colony, _node: NodeType
): boolean {
  return canSendTrojan(G, attacker, victim);
}

export function listTrojanTargets(
  G: GameState, attacker: Colony
): Array<{ victim: Colony; node: NodeType; attackerLine: LogisticsLine; victimLine: LogisticsLine }> {
  const out: Array<{
    victim: Colony; node: NodeType; attackerLine: LogisticsLine; victimLine: LogisticsLine;
  }> = [];
  const free = trojanSendFreeLines(attacker);
  if (!free.length) return out;
  // Prefer Subversion excess; send does not need a cargo node anymore
  const attackerLine = free[0]!;
  for (const victim of G.colonies) {
    if (!canSendTrojan(G, attacker, victim)) continue;
    // Placeholder node field kept for move key compat — always Subversion
    out.push({
      victim,
      node: "Subversion",
      attackerLine,
      victimLine: victim.logisticsLines[0]!, // unused in 0.8.3 send
    });
  }
  return out;
}

/**
 * Send Subversion / Trojan: occupy attacker's free logistics line as trojanSend.
 * Sets permanent subversionMark on target; does NOT grant them a trade node.
 */
export function executeTrojanSend(
  G: GameState,
  attacker: Colony,
  victim: Colony,
  attackerLineId: string,
): boolean {
  const d = deps();
  if (!canSendTrojan(G, attacker, victim)) {
    d.pushLog(G, `Trojan send rejected (${attacker.name} → ${victim.name}).`);
    return false;
  }
  const aLine = d.findLine(attacker, attackerLineId);
  if (!aLine || aLine.lentTo || aLine.trojanSend || aLine.route !== null) return false;
  if (aLine.exportRoute != null) return false;

  aLine.trojanSend = { targetId: victim.id, targetName: victim.name };
  aLine.exportRoute = null;
  aLine.trojanExport = false;

  victim.subversionMark = true;
  // Soft pressure: bump developed Subversion without clean import
  victim.developed.Subversion = (victim.developed.Subversion || 0) + 0; // mark only; ledger reads subversionMark
  if ((victim.developed.Subversion || 0) < 1) {
    // optional pressure without granting extras via specialty path — use mark only
  }

  d.pushLog(
    G,
    `${attacker.name} sends Subversion (Trojan) to ${victim.name} via ${aLine.name} (reverse logistics — no trade node).` +
      (isIndependent(victim) ? "" : ` ${victim.name} marked (permanent subversion).`),
    true
  );
  attacker.acted = true;
  return true;
}

/** Cancel Trojan send line — frees the line; permanent mark on target remains. */
export function cancelTrojanSend(G: GameState, attacker: Colony, lineId: string): boolean {
  const d = deps();
  const line = d.findLine(attacker, lineId);
  if (!line?.trojanSend) return false;
  const name = line.trojanSend.targetName;
  line.trojanSend = null;
  d.pushLog(G, `${attacker.name} ends Trojan send to ${name} on ${line.name} (mark remains).`, true);
  return true;
}

/**
 * @deprecated 0.8.3 — use executeTrojanSend. Kept signature for engine wiring.
 * Ignores cargo node / victim line; performs reverse-logistics send.
 */
export function executeTrojan(
  G: GameState,
  attacker: Colony,
  victim: Colony,
  _node: NodeType,
  attackerLineId: string,
  _victimLineId: string,
  _rng: Rng
): boolean {
  return executeTrojanSend(G, attacker, victim, attackerLineId);
}

/**
 * Subversion import (0.9.1): acquiring Subversion as a *tool* does NOT mark the importer.
 * Only Trojan send marks the target (executeTrojanSend).
 */
export function onSubversionRouteStart(G: GameState, actor: Colony): void {
  // Intentionally no subversionMark / fervor charge on importer.
  if (isIndependent(actor)) return;
  deps().pushLog(G, `${actor.name} imports Subversion (tool — no self mark).`);
}

/** Subversion develop (0.9.1): building the tool does NOT mark the developer. */
export function onSubversionDevelop(G: GameState, actor: Colony): void {
  if (isIndependent(actor)) return;
  deps().pushLog(G, `${actor.name} develops Subversion (tool — no self mark).`);
}

/** Subjects: refuse enemy Subversion trade unless stranded (legacy gate). */
export function shouldAcceptEnemySubversion(G: GameState, actor: Colony, source: L3TradeSource): boolean {
  if (source.kind === "earth") return true;
  if (source.node !== "Subversion") return true;
  const aff = deps().socialAffinity(G, actor, source.colony);
  if (aff >= 2 || sameBloc(actor, source.colony)) return true;
  return trojanAcceptanceGate(G, actor, "Subversion");
}

// silence unused DEPS import warning helper
void DEPS;
void NODES;
