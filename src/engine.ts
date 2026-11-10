import { tickGeopolitics } from "./l7.js";
import * as crises from "./crises.js";
import { ruleNum, ruleOn } from "./rules.js";
import { tickProjects } from "./l5.js";
import { chance, mulberry32, pick, type Rng } from "./rng.js";
import {
  nextColonyName,
  SPECIALTY_FLAVOR,
  IDEOLOGY_NAME_HINT,
  NAME_TEMPLATES,
  CULTURE_BANKS,
  SPECIALTY_TERMS,
  SUFFIXES,
  resolveCultureFamily,
  assembleColonyName,
} from "./naming.js";
export {
  nextColonyName,
  SPECIALTY_FLAVOR,
  IDEOLOGY_NAME_HINT,
  NAME_TEMPLATES,
  CULTURE_BANKS,
  SPECIALTY_TERMS,
  SUFFIXES,
  resolveCultureFamily,
  assembleColonyName,
};
import {
  NODES, DEPS, emptyNodes, extras, strainOf, rp, rpNodeScore, logisticsRpContribution,
  colonyLevel, logiAvail, logiCap, bodyModFor, bodyAdj, missingDepsOf, strainedNodes, freeExcessNodes,
  freeLines, occupiedLines, occupiedLineCount, freeLineCount,
  activeImportCount, cleanCount, stackedDepNeeds, depCoverRequired,
} from "./nodes.js";
import type {
  Alliance, Body, Colony, EarthBloc, ExcessSlot, ExportRoute, FoundingAnnouncement,
  GameMode, GameState, ImportRoute, IndependentGroupSnap, LineReach, LogEntry, LogisticsLine, NodeType,
} from "./types.js";
import {
  earthTradeAllowed, evaluateAllianceShifts, isFriendlyEarthBloc, isVitalNeed,
  lineCanServeTrade, lineCanServeExport, pickExportLine, clearExportToImporter, reachForBody,
  reachForLogisticsImport, MAX_OPPOSITE_EARTH_ROUTES, countOppositeAllianceEarthRoutes,
  earthBlocSocialAffinity, hasFriendlyAlternative, actorEarthAlliance,
} from "./trade.js";
import {
  bindL3, tickFervor, tryIndependentFound, canIndependentFound, listTrojanTargets,
  executeTrojan, executeTrojanSend, cancelTrojanSend, onSubversionRouteStart, onSubversionDevelop,
  shouldAcceptEnemySubversion, sameBloc,
  isIndependent, INDEPENDENT_PATRON, FERVOR_THRESHOLD, MISSING_BASAL_FERVOR_CAP, BASAL_NODES,
  wouldSeverOnRevolution, wouldSeverEarthBloc, independenceScore, missingBasals,
  importsFromPatronNetwork, trojanAcceptanceGate, hasFriendlySource, nodeFixesHardIssue,
  freeOwnNonBaseLines, cultureMisalignedWithPatron, ideologyMisalignedWithPatron,
  severableLinkCount, exitSafetyHigh, executeRevolution, maybeRevolution, canAttemptRevolution,
  computeFervorLedger, canSendTrojan, trojanSendFreeLines,
  applyFervorParams, fervorParamsOf, DEFAULT_FERVOR_PARAMS, LEGACY_FERVOR_PARAMS,
  colonyAgeTurns, hasAllianceTradeLockout, hasSurvivalFailurePressure,
  type FervorParams,
} from "./l3.js";
import {
  FOUNDING_COOLDOWN_TURNS, MOON_SOFT_CAP, SOLAR_BLOC_COOLDOWN_TURNS,
  MARS_MOON_MIN_COLONIES, MARS_MOON_RP_SUM,
  foundingBody, foundingBodyFor, foundingCooldownReady, hasNationFeedSurplus,
  nationColorForColony, nationColorForEarth, nationRpEarth, sameNation, allNationRp,
  leadingNation, canFoundMars, hasStrongLunarBasis, hasLunarAllyFeed,
  nationMoonColonies, hasLogisticsExportCapacity,
  applySolarBlocParams, solarBlocParamsOf, solarBlocMinTurn,
  DEFAULT_SOLAR_BLOC_PARAMS, LEGACY_SOLAR_BLOC_PARAMS,
  type SolarBlocParams,
  beltReachOf,
} from "./nation.js";
import {
  bindV080, tryFeedNewColony, tryRelationFoundSolarBloc, maybeVitalRouteCuts,
  tagRouteVital, unfairExtractionFervorDelta, onVitalIntraNationCancel,
  cultureIdeologyAffinity, solarBlocNameFromLiege,
} from "./v080.js";
import {
  bindL4, setIndependenceThreshold, independenceThresholdOf, hasHealth, isBodyLivable,
  hasInvasionToken, burnMilitaryToken, destroyOneDevelopedNode, canInvade, listInvadeTargets,
  invade, tickSurvivalClocks, emitRefugees, maybeAutoInvade, decayThreatTrack, threatLevel,
  ensureClocks, STATIONED_DEFENSE, TF_LIVABLE, SURVIVAL_CLOCK_TRIP, EARTH_THREAT_KEY,
  DEFAULT_INDEPENDENCE_THRESHOLD, INVADE_DESTROY_PRIORITY, annexColony,
  SURVIVAL_RESOURCES, survivalShortfall,
} from "./l4.js";

export const TIER: Record<string, number> = {
  "United States": 5, China: 5, SpaceX: 5, "Corporate China": 5,
  "European Union": 5, "Russian Federation": 5,
  "East Asian Pacific Alliance": 10, "South Asian Commonwealth": 10,
  "Dominion of Indochina": 10, "United Nations": 10,
  "Latin Federation": 15, "African Union": 15, "New Caliphate": 15,
  "British Commonwealth": 15,
};
export const UNCAPPED_FOUNDERS = new Set(["United States", "China"]);
export function isUncappedFounder(name: string): boolean {
  return UNCAPPED_FOUNDERS.has(name);
}
export function canBlocFound(b: EarthBloc): boolean {
  return isUncappedFounder(b.name) || b.tech >= b.cap;
}

/** Founding tax (anti-bloat): uncapped US/China pay colonyCount; others pay 2+colonyCount. */
export function foundingTax(b: EarthBloc): number {
  if (isUncappedFounder(b.name)) return Math.max(0, b.colonies);
  return 2 + b.colonies;
}

/** Specialty pools for future "realistic" mode. Ignored while gameMode === "random". */
export const SPECIALTIES: Record<string, readonly NodeType[]> = {
  "United States": ["Food", "Military", "Science"],
  China: ["Subversion", "Culture", "Production"],
  SpaceX: ["Population", "Thrust"],
  "Corporate China": ["Ideology", "Subversion"],
  "European Union": ["Military", "Stability", "Science"],
  "Russian Federation": ["Logistics", "Thrust"],
  "Latin Federation": ["Money", "Food"],
  "African Union": ["Food", "Energy"],
  "New Caliphate": ["Energy", "Ideology"],
  "South Asian Commonwealth": ["Population", "Food"],
  "East Asian Pacific Alliance": ["Production", "Science"],
  "Dominion of Indochina": ["Population", "Terraforming"],
  "British Commonwealth": ["Logistics", "Culture"],
  "United Nations": ["Ideology", "Stability"],
};

/**
 * Culture-rooted name stems for Earth patrons (0.7.2).
 * SpaceX → Corporate American; Corporate China → Corporate Chinese — never bare "SpaceX".
 */
export const NATION_ADJ: Record<string, string> = {
  "United States": "American",
  China: "Chinese",
  SpaceX: "Corporate American",
  "Corporate China": "Corporate Chinese",
  "European Union": "European",
  "Russian Federation": "Russian",
  "Latin Federation": "Latin",
  "African Union": "African",
  "New Caliphate": "Caliphate",
  "South Asian Commonwealth": "South Asian",
  "East Asian Pacific Alliance": "East Asian",
  "Dominion of Indochina": "Indochinese",
  "British Commonwealth": "British",
  "United Nations": "UN",
  Independent: "Independent",
};
export const ALLIANCES: Record<string, Alliance> = {
  "United States": "West", China: "East", SpaceX: "West", "Corporate China": "East",
  "European Union": "West", "Russian Federation": "East",
  "Latin Federation": "Neutral", "African Union": "Neutral", "New Caliphate": "Neutral",
  "South Asian Commonwealth": "Neutral", "East Asian Pacific Alliance": "Neutral",
  "Dominion of Indochina": "Neutral", "British Commonwealth": "West", "United Nations": "Neutral",
};
/**
 * Founder cultures (0.7.2): nation-states keep classic tags; corp blocs use cyberpunk corp flavors.
 * SpaceX → Corporate American; Corporate China → Corporate Chinese.
 */
export const CULTURES: Record<string, string> = {
  "United States": "American", China: "Chinese",
  SpaceX: "Corporate American", "Corporate China": "Corporate Chinese",
  "European Union": "European", "Russian Federation": "Russian", "Latin Federation": "Latin",
  "African Union": "African", "New Caliphate": "Caliphate", "South Asian Commonwealth": "South Asian",
  "East Asian Pacific Alliance": "East Asian", "Dominion of Indochina": "Indochinese",
  "British Commonwealth": "Commonwealth", "United Nations": "International",
};
/**
 * Governing ideologies (0.7.2).
 * SpaceX: Corporate Pioneerism — corporatist cyberpunk US / orbital market-state flavor.
 * Corporate China: Platform Socialism — corporatist PRC platform-state flavor.
 */
export const IDEOLOGIES: Record<string, string> = {
  "United States": "Democratic Free Market", China: "Chinese Socialism",
  SpaceX: "Corporate Pioneerism", "Corporate China": "Platform Socialism",
  "European Union": "Social Market", "Russian Federation": "Putinism",
  "Latin Federation": "Bolivarian Mix", "African Union": "Developmentalism",
  "New Caliphate": "Political Islam", "South Asian Commonwealth": "Plural Democracy",
  "East Asian Pacific Alliance": "Developmental Conservatism",
  "Dominion of Indochina": "Pragmatic Developmentalism",
  "British Commonwealth": "Liberal Constitutionalism", "United Nations": "Global Institutionalism",
};

/** Realistic-mode founding specialty shortlist (unused in random). */
const FOUNDING_SPECS: readonly NodeType[] = [
  "Resources","Science","Terraforming","Culture","Thrust","Military","Production","Logistics",
];
const BLOC_ORDER = [
  "United States","China","SpaceX","Corporate China","European Union","Russian Federation",
  "Latin Federation","African Union","New Caliphate","South Asian Commonwealth",
  "East Asian Pacific Alliance","Dominion of Indochina","British Commonwealth","United Nations",
] as const;
const CULTURE_POOL = ["Russian","Indochinese","European","American","Chinese"] as const;
const IDEOLOGY_POOL = ["Situationism","Market Realism","Technocracy","Pioneerism","Socialism"] as const;

export type TradeSource =
  | { kind: "earth"; bloc: EarthBloc; node: NodeType; slotIndex: number }
  | { kind: "colony"; colony: Colony; node: NodeType };

export type PlayerMove =
  | { kind: "start"; lineId: string; source: TradeSource }
  | { kind: "start-lend"; lenderId: string; lenderLineId: string; source: TradeSource }
  | { kind: "switch"; lineId: string; source: TradeSource }
  | { kind: "cancel-route"; lineId: string }
  | { kind: "cancel-logistics-import"; lineId: string }
  | { kind: "import-logistics"; source: TradeSource }
  | { kind: "found-colony" }
  | { kind: "trojan"; victimId: string; node: NodeType; attackerLineId: string; victimLineId: string }
  | { kind: "cancel-trojan-send"; lineId: string }
  | { kind: "counter-request"; lineId: string; counterNode: NodeType }
  | { kind: "counter-consent"; lineId: string; accept: boolean }
  | { kind: "invade"; defenderId: string };

export function pushLog(G: GameState, msg: string, imp = false): void {
  G.log.push({ turn: G.turn, msg, imp });
}
function makeSlot(node: NodeType): ExcessSlot { return { node, claimedBy: null }; }

function excessPool(mode: GameMode, name: string): readonly NodeType[] {
  if (mode === "realistic") return SPECIALTIES[name] || NODES;
  return NODES;
}

function makeBloc(name: string, rng: Rng, mode: GameMode): EarthBloc {
  return {
    name, alliance: ALLIANCES[name] || "Neutral", tech: 0, cap: TIER[name] || 10,
    excess: [makeSlot(pick(rng, excessPool(mode, name)))], colonies: 0,
    nationColor: nationColorForEarth(name),
  };
}

/** @deprecated 0.7.2 chance — modular naming uses ~25% ideology in naming.ts */
export const IDEOLOGY_NAME_CHANCE = 0.25;

/** @deprecated use nextColonyName — kept as thin wrapper for patron-only callers. */
function nextName(G: GameState, patron: string, body: Body, specialty: NodeType, culture?: string, ideology?: string, rng?: Rng): string {
  return nextColonyName(G, {
    culture: culture || NATION_ADJ[patron] || CULTURES[patron] || patron,
    specialty,
    body,
    ideology: ideology ?? IDEOLOGIES[patron] ?? null,
    patron,
    rng,
  });
}

function allocLineId(c: Colony): string { return `L${c.nextLineId++}`; }

function makeBaseLine(c: Colony): LogisticsLine {
  return {
    id: allocLineId(c), name: `${c.name} base logistics`, kind: "base",
    route: null, exportRoute: null, lentTo: null, reach: reachForBody(c.body),
  };
}

function makeSpecialtyLogisticsLine(c: Colony): LogisticsLine {
  return {
    id: allocLineId(c),
    name: `${c.name} specialty logistics`,
    kind: "specialty",
    route: null,
    exportRoute: null,
    lentTo: null,
    reach: reachForBody(c.body),
  };
}

export function makeColony(G: GameState, cfg: {
  patron: string; body: Body; specialty: NodeType; requires: NodeType;
  culture: string[]; ideology: string[]; name?: string; liegeId?: string | null;
  rng?: Rng;
}): Colony {
  // 0.20.0 asteroid mining: belt colonies favour Thrust / Production / Resources / Logistics (specialty ×2)
  const beltRich = cfg.body === "Belt" && !!G.rules && ruleOn(G, "beltRichSpecialty");
  if (beltRich) {
    const opts: NodeType[] = ["Thrust", "Production", "Resources", "Logistics"];
    const sp = cfg.rng ? pick(cfg.rng, opts) : opts[G.nextColonyId % opts.length]!;
    cfg = { ...cfg, specialty: sp, requires: cfg.requires === sp ? "Oxygen" : cfg.requires };
  }
  const c: Colony = {
    id: `c${G.nextColonyId++}`,
    name: cfg.name ?? nextColonyName(G, {
      culture: cfg.culture[0] || NATION_ADJ[cfg.patron] || CULTURES[cfg.patron] || "Mixed",
      specialty: cfg.specialty,
      body: cfg.body,
      ideology: cfg.ideology[0] ?? IDEOLOGIES[cfg.patron] ?? null,
      patron: cfg.patron,
      rng: cfg.rng,
    }),
    patron: cfg.patron,
    originPatron: cfg.patron === "Independent" && cfg.liegeId
      ? (G.colonies.find((x) => x.id === cfg.liegeId)?.originPatron ?? cfg.patron)
      : cfg.patron,
    liegeId: cfg.liegeId ?? null,
    fervor: 0,
    foundedTurn: G.turn || 1,
    body: cfg.body, bodyMod: bodyModFor(cfg.body),
    culture: cfg.culture.slice(), ideology: cfg.ideology.slice(),
    ideologyDevelopCount: 0, ideologyImported: [],
    specialty: cfg.specialty, requires: cfg.requires,
    developed: emptyNodes(), logisticsLines: [], nextLineId: 1, acted: false,
    foodClock: 0, waterClock: 0, oxygenClock: 0, populationStress: 0, militaryTokenBurned: false,
  };
  if (beltRich) c.beltRich = true;
  c.logisticsLines.push(makeBaseLine(c));
  // Logistics specialty starts with a second free specialty line (counts toward RP once).
  if (cfg.specialty === "Logistics") {
    c.logisticsLines.push(makeSpecialtyLogisticsLine(c));
  }
  return c;
}

export function rollSpecialtyRequires(rng: Rng, mode: GameMode): { specialty: NodeType; requires: NodeType } {
  const specialty = mode === "realistic"
    ? pick(rng, FOUNDING_SPECS)
    : pick(rng, NODES);
  const requires = pick(rng, NODES.filter((n) => n !== specialty));
  return { specialty, requires };
}

export function createGame(seed: number, rng?: Rng): GameState {
  const r = rng ?? mulberry32(seed);
  const gameMode: GameMode = "random";
  const G: GameState = {
    turn: 1, seed, gameMode, blocs: [], colonies: [], bodyTF: { Moon: 0, Mars: 0, Belt: 0 },
    log: [], nameSerial: {}, nextColonyId: 1, pendingFoundings: [], turnAnnouncements: [],
    alliancePressure: {}, lastFoundTurn: -999, lastSolarBlocTurn: -999,
    independenceThreshold: DEFAULT_INDEPENDENCE_THRESHOLD,
    fervorParams: undefined,
    solarBlocParams: undefined,
    threatTrack: {}, lastRefugeeFoundTurn: -999,
  };
  for (const name of BLOC_ORDER) G.blocs.push(makeBloc(name, r, gameMode));
  // US / China patron Moon starters; specialty + requires fully random in random mode.
  const usRoll = rollSpecialtyRequires(r, gameMode);
  const us = makeColony(G, {
    patron: "United States", body: "Moon", specialty: usRoll.specialty, requires: usRoll.requires,
    culture: ["American"], ideology: ["Democratic Free Market"], rng: r,
  });
  const cnRoll = rollSpecialtyRequires(r, gameMode);
  const cn = makeColony(G, {
    patron: "China", body: "Moon", specialty: cnRoll.specialty, requires: cnRoll.requires,
    culture: ["Chinese"], ideology: ["Chinese Socialism"], rng: r,
  });
  G.colonies.push(us, cn);
  blocByName(G, "United States")!.colonies = 1;
  blocByName(G, "China")!.colonies = 1;
  pushLog(G, `L0 start (seed ${seed}, mode ${gameMode}). ${us.name} and ${cn.name} on the Moon.`, true);
  return G;
}

export function blocByName(G: GameState, name: string): EarthBloc | undefined {
  return G.blocs.find((b) => b.name === name);
}
/** True if colony has an Earth-reach logistics line (needed for Mars←Earth). */
export function hasEarthReach(c: Colony): boolean {
  return c.logisticsLines.some((l) => !l.lentTo && l.reach === "earth");
}

/** Higher = hungrier: unmet Requires, missing basals, strain, Mars without Earth reach. */
export function needScore(c: Colony): number {
  let s = 0;
  // Requires is always the growth gate until filled this action
  s += 8;
  s += missingBasals(c).length * 3;
  s += strainOf(c);
  if (c.body === "Mars" && !hasEarthReach(c)) s += 6;
  if (freeLineCount(c) === 0) s += 1;
  return s;
}

/**
 * Turn order. 0.17.1 rule `aiTurnOrderRp` (Tiago): highest RP first, then hungrier, then name.
 * Off / no rules: highest-need cities first (nation spine), then RP, then name.
 */
export function sortedColonies(G: GameState): Colony[] {
  const byRp = !!G.rules && ruleOn(G, "aiTurnOrderRp");
  return [...G.colonies].sort(
    (a, b) => byRp
      ? rp(b, G.bodyTF) - rp(a, G.bodyTF) || needScore(b) - needScore(a) || a.name.localeCompare(b.name)
      : needScore(b) - needScore(a) || rp(b, G.bodyTF) - rp(a, G.bodyTF) || a.name.localeCompare(b.name)
  );
}

// ── 0.17.1 AI (Tiago): spread develops to smaller friends; work Earth instead of passing ─────────

/** Same nation, or same (non-Neutral) Earth alliance. */
export function friendlyColonies(G: GameState, a: Colony, b: Colony): boolean {
  if (sameNation(a, b)) return true;
  const x = patronAllianceOf(G, a);
  return !!x && x !== "Neutral" && x === patronAllianceOf(G, b);
}

/**
 * Sources of `node` the actor should leave to smaller friends (aiSpreadDevelop): for each friendly colony
 * ≥ gap levels below the actor that has not acted, needs `node` as Requires and can take a source with
 * its own free line, reserve its best such source.
 */
export function reservedForSmallerFriends(G: GameState, actor: Colony, node: NodeType): Set<string> {
  const out = new Set<string>();
  const maxLvl = colonyLevel(actor) - ruleNum(G, "aiSpreadGap");
  const smalls = G.colonies
    .filter((o) => o.id !== actor.id && !o.acted && o.requires === node && colonyLevel(o) <= maxLvl && friendlyColonies(G, actor, o))
    .sort((a, b) => colonyLevel(a) - colonyLevel(b) || a.name.localeCompare(b.name));
  for (const o of smalls) {
    const free = freeLines(o);
    const usable = findSources(G, o, node).filter((s) =>
      !(s.kind === "colony" && s.colony.id === actor.id)
      && free.some((l) => lineCanServeTrade(l, o, s)) && !out.has(tradeSourceKey(s)));
    const best = pickBestSource(G, o, usable);
    if (best) out.add(tradeSourceKey(best));
  }
  return out;
}

/** Feed a friendly colony's Requires from the actor's own surplus (develops it). Lowest level first. */
export function tryFeedFriendRequires(G: GameState, actor: Colony, rng: Rng, maxLevel: number): boolean {
  type Cand = { o: Colony; lineId: string };
  const cands: Cand[] = [];
  for (const o of G.colonies) {
    if (o.id === actor.id || colonyLevel(o) > maxLevel || !friendlyColonies(G, actor, o)) continue;
    const node = o.requires;
    if (node === "Logistics" || extras(actor, node) < 1) continue;
    if (!pickExportLine(actor, o)) continue;
    const src = { kind: "colony" as const, colony: actor, node };
    const line = freeLines(o).find((l) => lineCanServeTrade(l, o, src));
    if (line) cands.push({ o, lineId: line.id });
  }
  cands.sort((a, b) => colonyLevel(a.o) - colonyLevel(b.o) || a.o.name.localeCompare(b.o.name));
  for (const c of cands) {
    const node = c.o.requires;
    if (grantColonyImport(G, c.o, c.lineId, actor, node, rng)) {
      pushLog(G, `${actor.name} sends ${node} to ${c.o.name} so it can develop (L${colonyLevel(c.o) - 1}).`, true);
      afterColonyAction(G, actor, rng);
      return true;
    }
  }
  return false;
}

/**
 * aiSpreadDevelop: recall a line this colony lent to a colony ≥ gap levels bigger when the borrower uses it
 * for a non-vital route (or not at all) and the line could carry one of `reqSources` (our own develop).
 * Not an action by itself — the caller then develops on the returned line.
 */
export function tryRecallLentLine(G: GameState, actor: Colony, rng: Rng): boolean {
  if (actor.requires === "Logistics") return false;
  // Raw Requires sources that would be legal if we had our line back (findSources needs a usable line)
  const reqSources = findSourcesRaw(G, actor, actor.requires).filter((s) => s.kind === "earth"
    ? earthTradeAllowed(G, actor, s.bloc, s.node, CULTURES, IDEOLOGIES, socialAffinity, consentsExport)
    : !!pickExportLine(s.colony, actor) && !(s.node === "Subversion" && !shouldAcceptEnemySubversion(G, actor, s)));
  if (!reqSources.length || freeLines(actor).some((l) => reqSources.some((s) => lineCanServeTrade(l, actor, s)))) return false;
  // 0.18.0 aiLendAllies (anti-hoarding): any bigger ally returns a line it only uses for a no-longer-critical route
  const allyMode = !!G.rules && ruleOn(G, "aiLendAllies");
  const gap = allyMode ? 1 : ruleNum(G, "aiSpreadGap");
  for (const own of actor.logisticsLines) {
    if (!own.lentTo) continue;
    const b = G.colonies.find((c) => c.id === own.lentTo);
    if (!b || colonyLevel(b) < colonyLevel(actor) + gap) continue;
    if (allyMode && !friendlyColonies(G, actor, b)) continue;
    const borrowed = b.logisticsLines.find((l) => l.kind === "borrowed" && l.borrowedFrom?.colonyId === actor.id && l.borrowedFrom.lineId === own.id);
    if (!borrowed) continue;
    if (borrowed.route && (allyMode
      ? isVitalNeed(b, borrowed.route.node) || borrowed.route.node === b.requires
      : borrowed.route.vital || isVitalNeed(b, borrowed.route.node))) continue;
    if (borrowed.exportRoute != null) continue;
    if (!reqSources.some((s) => lineCanServeTrade({ ...own, lentTo: null }, actor, s))) continue;
    if (borrowed.route) clearRouteOnLine(G, b, borrowed, rng, true);
    if (returnLentLine(G, b, borrowed.id)) {
      pushLog(G, `${actor.name} takes back its logistics line from ${b.name} to develop.`, true);
      return true;
    }
  }
  return false;
}

/** Friendly Earth blocs for filling: own sovereign, same alliance, Neutral (rank ≤ −16; Independents by affinity). */
function friendlyEarthSlots(G: GameState, actor: Colony): { b: EarthBloc; i: number; open: number }[] {
  if (marsEarthless(G, actor)) return [];
  const out: { b: EarthBloc; i: number; open: number }[] = [];
  for (const b of G.blocs) {
    const open = b.excess.filter((x) => x.claimedBy === null).length;
    b.excess.forEach((slot, i) => {
      if (slot.claimedBy !== null || slot.node === "Logistics") return;
      const src: TradeSource = { kind: "earth", bloc: b, node: slot.node, slotIndex: i };
      if (rankSource(G, actor, src) > -16) return;
      if (!earthTradeAllowed(G, actor, b, slot.node, CULTURES, IDEOLOGIES, socialAffinity, consentsExport)) return;
      out.push({ b, i, open });
    });
  }
  return out.sort((x, y) => x.open - y.open || x.b.name.localeCompare(y.b.name) || x.i - y.i);
}
/** 0.18.0: claim (and keep) an unclaimed slot of a friendly Earth bloc on a free own line — the bloc closest to unlocking first. */
export function tryFillFriendlyEarth(G: GameState, actor: Colony, rng: Rng): boolean {
  const free = freeLines(actor).filter((l) => l.kind !== "borrowed" && !l.lentTo);
  if (!free.length) return false;
  for (const { b, i } of friendlyEarthSlots(G, actor)) {
    const slot = b.excess[i]!;
    const src: TradeSource = { kind: "earth", bloc: b, node: slot.node, slotIndex: i };
    const line = free.find((l) => lineCanServeTrade(l, actor, src));
    if (!line) continue;
    if (!claimEarthSlot(G, actor, b, i, slot.node, rng)) continue;
    line.route = makeRoute(src);
    applyRouteStartEffects(G, actor, src, rng);
    pushLog(G, `${actor.name} fills ${b.name}'s Earth slot (${slot.node}) to unlock more excess.`, true);
    afterColonyAction(G, actor, rng);
    return true;
  }
  return false;
}

/** Import Logistics from Earth (or a same-nation colony) for a new line — more capacity, and the Earth claim helps fill the bloc. */
export function tryImportLogisticsForCapacity(G: GameState, actor: Colony, rng: Rng): boolean {
  const sources = findSources(G, actor, "Logistics").filter((s) => s.kind === "earth" || sameNation(actor, s.colony));
  const best = pickBestSource(G, actor, sources);
  return best ? importLogistics(G, actor, best, rng) : false;
}

/**
 * Cooperative Earth unlock: move a non-vital colony-sourced (or unfriendly-Earth) route onto an unclaimed
 * slot of a friendly Earth bloc (own sovereign, allied or Neutral; rank ≤ −16), the bloc closest to
 * filling first — a full bloc develops a new excess slot.
 */
export function tryCoopEarthUnlock(G: GameState, actor: Colony, rng: Rng): boolean {
  if (marsEarthless(G, actor)) return false;
  const friendlyEarth = (s: TradeSource) => s.kind === "earth" && rankSource(G, actor, s) <= -16;
  const lines = occupiedLines(actor).filter((l) => {
    const r = l.route!;
    if (l.kind === "borrowed" || r.vital || r.earthCycle || r.node === actor.requires || isVitalNeed(actor, r.node)) return false;
    if (r.sourceKind === "earth") {
      const b = blocByName(G, r.sourceId) ?? G.blocs.find((x) => x.name === r.sourceName);
      if (b && friendlyEarth({ kind: "earth", bloc: b, node: r.node, slotIndex: -1 })) return false;
    }
    return true;
  });
  if (!lines.length) return false;
  const blocs = [...G.blocs]
    .map((b) => ({ b, open: b.excess.filter((x) => x.claimedBy === null).length }))
    .filter((x) => x.open > 0)
    .sort((a, b) => a.open - b.open || a.b.name.localeCompare(b.b.name));
  for (const { b } of blocs) {
    for (let i = 0; i < b.excess.length; i++) {
      const slot = b.excess[i]!;
      if (slot.claimedBy !== null || slot.node === "Logistics") continue;
      const src: TradeSource = { kind: "earth", bloc: b, node: slot.node, slotIndex: i };
      if (!friendlyEarth(src)) continue;
      if (!earthTradeAllowed(G, actor, b, slot.node, CULTURES, IDEOLOGIES, socialAffinity, consentsExport)) continue;
      const line = lines.find((l) => lineCanServeTrade(l, actor, src) && l.route!.node !== slot.node);
      if (!line) continue;
      pushLog(G, `${actor.name} joins ${b.name}'s Earth push (${slot.node}) to unlock a new excess.`, true);
      return switchRoute(G, actor, line.id, src, rng);
    }
  }
  return false;
}

export function develop(G: GameState, c: Colony, rng: Rng): void {
  (G as unknown as { __devTrace?: { turn: number; id: string; level: number; patron: string }[] }).__devTrace
    ?.push({ turn: G.turn, id: c.id, level: colonyLevel(c), patron: c.patron });
  const got = pick(rng, NODES.filter((n) => n !== c.specialty));
  c.developed[got] += 1;
  if (got === "Logistics") {
    c.logisticsLines.push({
      id: allocLineId(c), name: `${c.name} logistics works`, kind: "develop",
      route: null, exportRoute: null, lentTo: null, reach: reachForBody(c.body),
    });
    pushLog(G, `${c.name} opens logistics works (+1 line).`);
  }
  c.requires = pick(rng, NODES.filter((n) => n !== got));
  if (got === "Terraforming" && c.body === "Belt") {
    pushLog(G, `${c.name} develops Terraforming, but the Belt holds no atmosphere (no effect).`);
  } else if (got === "Terraforming") {
    G.bodyTF[c.body] = (G.bodyTF[c.body] || 0) + 1;
    pushLog(G, `${c.name} terraforms ${c.body}. Body quality is now ${G.bodyTF[c.body]}.`, true);
  }
  if (got === "Culture") {
    applyCultureDevelop(G, c, rng);
    evaluateAllianceShifts(G, CULTURES, IDEOLOGIES, pushLog, true);
  }
  if (got === "Ideology") {
    applyIdeologyDevelop(G, c, rng);
    evaluateAllianceShifts(G, CULTURES, IDEOLOGIES, pushLog, true);
  }
  if (got === "Subversion") onSubversionDevelop(G, c);
  if (got === "Military") c.militaryTokenBurned = false;
  pushLog(G, `${c.name} develops +1 ${got}. Now requires ${c.requires}. Strain ${strainOf(c)}.`, true);
}

function drawExcess(G: GameState, b: EarthBloc, rng: Rng): NodeType {
  if (G.gameMode === "realistic") {
    if (chance(rng, 0.8)) return pick(rng, SPECIALTIES[b.name] || NODES);
    return pick(rng, NODES);
  }
  // random mode: uniform from full NODES (ignore SPECIALTIES pools)
  return pick(rng, NODES);
}
function rerollExcess(G: GameState, b: EarthBloc, rng: Rng): NodeType {
  if (G.gameMode === "realistic") {
    return pick(rng, SPECIALTIES[b.name] || (["Resources"] as NodeType[]));
  }
  return pick(rng, NODES);
}

export function maybeGrowEarth(G: GameState, b: EarthBloc, rng: Rng): void {
  if (b.excess.length === 0) return;
  if (!b.excess.every((s) => s.claimedBy !== null)) return;
  const extra = drawExcess(G, b, rng);
  b.excess.push(makeSlot(extra));
  pushLog(G, `${b.name} all excess claimed → develops new free excess ${extra} (${b.excess.length} slots).`, true);
}

export function earthClaimedCount(b: EarthBloc): number {
  return b.excess.filter((s) => s.claimedBy !== null).length;
}
export function importCostsLogistics(node: NodeType): boolean {
  return node !== "Logistics";
}

/**
 * Social assist affinity (0–3): colonies assist those they share with.
 * +1 bloc: same Earth *alliance* (mutable) OR Independent same liegeId;
 * +1 shared culture; +1 shared ideology (incl. imported).
 */
export function socialAffinity(G: GameState, a: Colony, b: Colony): number {
  let score = 0;
  if (isIndependent(a) && isIndependent(b)) {
    if (a.liegeId && a.liegeId === b.liegeId) score += 1;
  } else if (!isIndependent(a) && !isIndependent(b)) {
    const aA = blocByName(G, a.patron)?.alliance;
    const bA = blocByName(G, b.patron)?.alliance;
    if (aA && bA && aA === bA) score += 1;
  }
  if (a.culture.some((t) => b.culture.includes(t))) score += 1;
  const ideoA = new Set([...a.ideology, ...a.ideologyImported]);
  const ideoB = new Set([...b.ideology, ...b.ideologyImported]);
  for (const tag of ideoA) {
    if (ideoB.has(tag)) { score += 1; break; }
  }
  return score;
}

/** Earth alliance of a colony's patron, or null if Independent. */
export function patronAllianceOf(G: GameState, c: Colony): Alliance | null {
  if (isIndependent(c)) return null;
  return blocByName(G, c.patron)?.alliance ?? null;
}

export function isNeutralPatronColony(G: GameState, c: Colony): boolean {
  return patronAllianceOf(G, c) === "Neutral";
}

/**
 * Colony↔colony trade/lend partner gate (0.8.3 + Neutral exception):
 * - sameBloc (same patron / Independent same liege) → OK
 * - either party Neutral-patron → OK (Neutrals trade with everyone)
 * - same West or same East Earth alliance → OK
 * - else (West↔East rivals, Independent↔non-Neutral, …) → require socialAffinity ≥ 2
 * Earth↔colony Neutral blocs stay open via earthTradeAllowed (not this gate).
 */
export function colonyTradeOk(G: GameState, a: Colony, b: Colony): boolean {
  if (a.id === b.id) return false;
  if (a.nomad || b.nomad) return false; // 0.19.0 camps don't trade
  if (sameBloc(a, b)) return true;
  if (isNeutralPatronColony(G, a) || isNeutralPatronColony(G, b)) return true;
  const aAll = patronAllianceOf(G, a);
  const bAll = patronAllianceOf(G, b);
  if (aAll && bAll && aAll === bAll) return true; // Neutral already returned above
  return socialAffinity(G, a, b) >= 2;
}

/** Export consent: extras + colonyTradeOk (0.8.3). No weak commercial for rivals. */
export function consentsExport(G: GameState, donor: Colony, recipient: Colony, node: NodeType): boolean {
  if (extras(donor, node) < 1) return false;
  return colonyTradeOk(G, donor, recipient);
}

/** Lend assist: same as trade partner gate (0.8.3). */
export function assistsColony(G: GameState, donor: Colony, recipient: Colony): boolean {
  return colonyTradeOk(G, donor, recipient);
}

export function findUnclaimedSlot(b: EarthBloc, node: NodeType): number {
  return b.excess.findIndex((s) => s.node === node && s.claimedBy === null);
}
export function findLine(c: Colony, lineId: string): LogisticsLine | undefined {
  return c.logisticsLines.find((l) => l.id === lineId);
}

function sourceLabel(s: TradeSource): string {
  return s.kind === "earth" ? s.bloc.name : s.colony.name;
}
function sourceIdOf(s: TradeSource): string {
  return s.kind === "earth" ? s.bloc.name : s.colony.id;
}

export function releaseEarthClaim(G: GameState, b: EarthBloc, slotIndex: number, rng: Rng, actorName: string): void {
  if (slotIndex < 0 || slotIndex >= b.excess.length) return;
  const slot = b.excess[slotIndex]!;
  const old = slot.node;
  slot.claimedBy = null;
  slot.node = rerollExcess(G, b, rng);
  pushLog(G, `${actorName} releases ${b.name} excess: ${old} → ${slot.node} (reroll; switch cost).`, true);
}

function claimEarthSlot(G: GameState, actor: Colony, b: EarthBloc, slotIndex: number, node: NodeType, rng: Rng): boolean {
  if (slotIndex < 0 || slotIndex >= b.excess.length) { pushLog(G, "That Earth node is not available."); return false; }
  const slot = b.excess[slotIndex]!;
  if (slot.node !== node || slot.claimedBy !== null) {
    pushLog(G, slot.claimedBy ? "That Earth excess is claimed by another colony." : "That Earth node is not available.");
    return false;
  }
  slot.claimedBy = actor.id;
  b.tech = Math.min(b.cap + 8, b.tech + 1);
  pushLog(G, `${actor.name} starts Earth export of ${node} from ${b.name}. ${b.name} tech ${b.tech}/${b.cap}.`, true);
  maybeGrowEarth(G, b, rng);
  return true;
}

function validateTradeSource(
  G: GameState, actor: Colony, source: TradeSource, reclaimLineId?: string
): boolean {
  if (source.kind === "earth") {
    if (marsEarthless(G, actor)) return false;
    const slot = source.bloc.excess[source.slotIndex];
    if (!slot || slot.node !== source.node || slot.claimedBy !== null) return false;
    return earthTradeAllowed(
      G, actor, source.bloc, source.node, CULTURES, IDEOLOGIES, socialAffinity, consentsExport
    );
  }
  if (source.colony.id === actor.id) return false;
  if (!(extras(source.colony, source.node) >= 1 && consentsExport(G, source.colony, actor, source.node))) {
    return false;
  }
  // Colony→colony needs an export slot on the source (reclaim OK when switching)
  if (!pickExportLine(source.colony, actor, reclaimLineId
    ? { reclaimImporterId: actor.id, reclaimImporterLineId: reclaimLineId }
    : undefined)) return false;
  // Subjects: do not take Subversion from enemies unless desperation gate
  if (source.node === "Subversion" && !shouldAcceptEnemySubversion(G, actor, source)) {
    return false;
  }
  return true;
}

function cultureTagFromSource(source: TradeSource): string {
  if (source.kind === "earth") {
    return CULTURES[source.bloc.name] || source.bloc.name.split(" ")[0]!;
  }
  return source.colony.culture[0] || CULTURES[source.colony.patron] || "Mixed";
}

function ideologyTagFromSource(source: TradeSource): string {
  if (source.kind === "earth") {
    return IDEOLOGIES[source.bloc.name] || "Localism";
  }
  // Prefer governing/original slot, else first imported, else patron default
  return source.colony.ideology[0]
    || source.colony.ideologyImported[0]
    || IDEOLOGIES[source.colony.patron]
    || "Localism";
}

/** Population import start: permanently append culture from source (survives cancel). */
function applyCultureImport(G: GameState, actor: Colony, source: TradeSource): void {
  if (source.node !== "Population") return;
  const add = cultureTagFromSource(source);
  if (!actor.culture.includes(add)) {
    actor.culture.push(add);
    pushLog(G, `${actor.name} gains culture ${add} (permanent). Now ${actor.culture.join("/")}.`, true);
  }
}

function blendLabel(a: string, b: string): string {
  if (a === b) return a;
  // Known style blends
  const pair = new Set([a, b]);
  if (pair.has("Chinese") && pair.has("Russian")) return "Eurasian";
  if (pair.has("American") && pair.has("European")) return "Atlantic";
  return `${a}-${b} hybrid`;
}

function applyCultureDevelop(G: GameState, c: Colony, rng: Rng): void {
  if (c.culture.length <= 1 && chance(rng, 0.5)) {
    const foreign = pick(rng, CULTURE_POOL.filter((x) => !c.culture.includes(x)));
    c.culture.push(foreign);
    pushLog(G, `${c.name} develops culture → appends ${foreign}. Now ${c.culture.join("/")}.`, true);
  } else {
    const present = c.culture.length ? c.culture.slice() : ["Local"];
    const hybrid = present.length >= 2
      ? blendLabel(present[0]!, present[1]!)
      : `${present[0]}-hybrid`;
    c.culture = [hybrid];
    pushLog(G, `${c.name} develops culture → blend ${hybrid}.`, true);
  }
}

function applyIdeologyDevelop(G: GameState, c: Colony, rng: Rng): void {
  const tag = pick(rng, IDEOLOGY_POOL);
  c.ideologyDevelopCount += 1;
  if (c.ideologyImported.length > 0) {
    const lastImp = c.ideologyImported[c.ideologyImported.length - 1]!;
    const hybrid = `${lastImp}-${tag}`;
    c.ideology = [hybrid];
    pushLog(G, `${c.name} ideology blend (import+develop): ${hybrid}.`, true);
    return;
  }
  if (c.ideologyDevelopCount === 1) {
    // First developed Ideology beyond original: coexist (append)
    if (!c.ideology.includes(tag)) c.ideology.push(tag);
    pushLog(G, `${c.name} ideology coexist: ${c.ideology.join(" / ")}.`, true);
  } else {
    // 2nd+ developed Ideology: overwrite original/majority slot (index 0)
    if (c.ideology.length === 0) c.ideology = [tag];
    else c.ideology[0] = tag;
    pushLog(G, `${c.name} ideology overwrite → ${c.ideology.join(" / ")}.`, true);
  }
}

/** Ideology import start: permanently append source ideology (survives cancel). */
function applyIdeologyImport(G: GameState, actor: Colony, source: TradeSource): void {
  if (source.node !== "Ideology") return;
  const tag = ideologyTagFromSource(source);
  if (!actor.ideologyImported.includes(tag)) actor.ideologyImported.push(tag);
  if (!actor.ideology.includes(tag)) {
    actor.ideology.push(tag);
    pushLog(G, `${actor.name} imports ideology ${tag} (permanent). Now ${actor.ideology.join(" / ")}.`, true);
  } else {
    pushLog(G, `${actor.name} imports ideology ${tag} (already present; marked imported).`);
  }
}

export function applyRouteStartEffects(G: GameState, actor: Colony, source: TradeSource, _rng: Rng): void {
  applyCultureImport(G, actor, source);
  applyIdeologyImport(G, actor, source);
  if (source.node === "Subversion") onSubversionRouteStart(G, actor);
}

function makeRoute(source: TradeSource): ImportRoute {
  return {
    sourceKind: source.kind, sourceId: sourceIdOf(source), sourceName: sourceLabel(source),
    node: source.node, slotIndex: source.kind === "earth" ? source.slotIndex : undefined,
    counterNode: source.kind === "colony" ? null : undefined,
    counterConsent: source.kind === "colony" ? false : undefined,
  };
}

export function clearRouteOnLine(G: GameState, actor: Colony, line: LogisticsLine, rng: Rng, silent = false): void {
  const route = line.route;
  // 0.19.0 relay: giver loses its Earth import → the relay ends; taker ends a relay → line disappears
  if (line.relayTo) crises.dropRelay(G, line);
  if (line.relay) {
    crises.releaseRelaySlot(G, line);
    const i = actor.logisticsLines.indexOf(line);
    if (i >= 0) actor.logisticsLines.splice(i, 1);
    line.route = null;
    if (route && !silent) pushLog(G, `${actor.name} ends relay of ${route.node} from ${route.sourceName}.`, true);
    return;
  }
  if (!route && !line.trojanExport && !line.exportRoute) return;
  if (route) {
    const wasVital = !!route.vital || isVitalNeed(actor, route.node);
    let sourceSameNation = false;
    if (route.sourceKind === "earth") {
      const b = blocByName(G, route.sourceId);
      if (b && route.slotIndex !== undefined) releaseEarthClaim(G, b, route.slotIndex, rng, actor.name);
      sourceSameNation = route.sourceId === actor.patron;
    } else if (route.sourceKind === "colony") {
      const src = G.colonies.find((c) => c.id === route.sourceId);
      if (src) sourceSameNation = sameNation(actor, src);
      clearInboundCounter(G, actor.id, line.id);
      clearExportToImporter(G, actor.id, line.id);
      // Clear our counter export leg if it was the bilateral return
      if (line.exportRoute && route.sourceId === line.exportRoute.colonyId) {
        line.exportRoute = null;
      }
    }
    if (!silent) {
      const tag = route.trojan || line.trojanExport ? " (Trojan)" : "";
      const vtag = wasVital ? " [vital]" : "";
      pushLog(G, `${actor.name} ends import of ${route.node} from ${route.sourceName} on ${line.name}${tag}${vtag}.`, true);
    }
    if (wasVital && sourceSameNation) {
      onVitalIntraNationCancel(G, actor, true, true);
    }
  }
  line.route = null;
  // Do not clear exportRoute here — export is independent of import on two-way lines
}

/** Free lender lines eligible to lend (route free, not already lent). */
export function lendableLines(c: Colony): LogisticsLine[] {
  return c.logisticsLines.filter(
    (l) =>
      l.route === null &&
      (l.exportRoute == null || l.exportRoute === undefined) &&
      !l.lentTo &&
      !l.trojanExport &&
      !l.trojanSend &&
      l.kind !== "borrowed"
  );
}

export type LenderPick = { colony: Colony; line: LogisticsLine; affinity: number; clearRoute?: boolean };

/** West vs East (Earth-aligned colonies only). */
export function opponentColonies(G: GameState, a: Colony, b: Colony): boolean {
  const x = patronAllianceOf(G, a), y = patronAllianceOf(G, b);
  return (x === "West" && y === "East") || (x === "East" && y === "West");
}
/** 0.18.0 non-critical lines a bigger ally may hand over: cycling probes first, then non-vital imports. */
function hoardedLines(c: Colony): LogisticsLine[] {
  const ok = (l: LogisticsLine) => l.kind !== "borrowed" && !l.lentTo && l.exportRoute == null && !l.trojanExport && !l.trojanSend
    && !!l.route && !l.route.vital && !isVitalNeed(c, l.route.node) && l.route.node !== c.requires;
  const lines = c.logisticsLines.filter(ok);
  return [...lines.filter((l) => l.route!.earthCycle), ...lines.filter((l) => !l.route!.earthCycle)];
}

/** Pick highest-affinity assisting colony with a free lendable line. */
export function pickBestLender(G: GameState, borrower: Colony, forSource?: TradeSource, minLenderLevel = 0): LenderPick | null {
  if (borrower.nomad) return null;
  const cands: LenderPick[] = [];
  for (const c of G.colonies) {
    if (c.id === borrower.id) continue;
    if (minLenderLevel > 0 && colonyLevel(c) < minLenderLevel) continue;
    const allyMode = !!G.rules && ruleOn(G, "aiLendAllies");
    const ally = allyMode && friendlyColonies(G, c, borrower);
    if (allyMode && opponentColonies(G, c, borrower)) continue; // always refuse opponents
    if (!ally && !assistsColony(G, c, borrower) && !sameNation(c, borrower)) continue;
    let lines = lendableLines(c);
    let clearRoute = false;
    // 0.18.0 anti-hoarding: a bigger ally hands over a cycling / non-critical line to a smaller ally with no line
    if (!lines.length && ally && colonyLevel(c) > colonyLevel(borrower) && freeLines(borrower).length === 0) {
      lines = hoardedLines(c); clearRoute = true;
    }
    // 0.18.0: an ally lends on request, but never the last free line it needs for its own Requires this turn
    if (allyMode && !clearRoute && !c.acted && lines.length === 1 && c.requires !== "Logistics"
      && findSources(G, c, c.requires).some((s) => lineCanServeTrade(lines[0]!, c, s))) continue;
    if (!lines.length) continue;
    for (const line of lines) {
      if (forSource && !lineCanServeTrade(line, borrower, forSource)) continue;
      const aff = socialAffinity(G, c, borrower);
      const nationBonus = sameNation(c, borrower) ? 10 : 0;
      cands.push({ colony: c, line, affinity: aff + nationBonus + (ally ? 5 : 0) - (clearRoute ? 20 : 0), clearRoute });
      break; // one line per lender
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.affinity - a.affinity || a.colony.name.localeCompare(b.colony.name));
  return cands[0]!;
}

/** Mark lender line lent; attach a temporary borrowed line on borrower. Returns borrowed line or null. */
export function lendLogisticsLine(
  G: GameState, lender: Colony, lenderLineId: string, borrower: Colony
): LogisticsLine | null {
  const line = findLine(lender, lenderLineId);
  if (!line || line.route !== null || line.exportRoute != null || line.lentTo || line.kind === "borrowed") return null;
  const allyMode = !!G.rules && ruleOn(G, "aiLendAllies");
  if (allyMode && opponentColonies(G, lender, borrower)) return null;
  if (!assistsColony(G, lender, borrower) && !sameBloc(lender, borrower) && !(allyMode && friendlyColonies(G, lender, borrower))) return null;
  line.lentTo = borrower.id;
  (G as unknown as { __lendTrace?: { turn: number; from: string; to: string }[] }).__lendTrace
    ?.push({ turn: G.turn, from: lender.body, to: borrower.body });
  const borrowed: LogisticsLine = {
    id: allocLineId(borrower),
    name: `via [${lender.name}] Logistics`,
    kind: "borrowed",
    sourceLabel: lender.name,
    route: null,
    exportRoute: null,
    lentTo: null,
    reach: line.reach ?? reachForBody(lender.body),
    borrowedFrom: { colonyId: lender.id, lineId: line.id },
  };
  if (line.beltOk) borrowed.beltOk = true; // 0.20.0: Thrust reach travels with the lent line
  borrower.logisticsLines.push(borrowed);
  pushLog(G, `${lender.name} lends ${line.name} to ${borrower.name} (via [${lender.name}] Logistics).`, true);
  return borrowed;
}

/** Clear lender lentTo and remove borrower's borrowed line (after route cleared). */
export function returnLentLine(G: GameState, borrower: Colony, borrowedLineId: string): boolean {
  const idx = borrower.logisticsLines.findIndex((l) => l.id === borrowedLineId);
  if (idx < 0) return false;
  const borrowed = borrower.logisticsLines[idx]!;
  if (borrowed.kind !== "borrowed" || !borrowed.borrowedFrom) return false;
  if (borrowed.route !== null || borrowed.exportRoute != null) return false;
  const lender = G.colonies.find((c) => c.id === borrowed.borrowedFrom!.colonyId);
  if (lender) {
    const ll = findLine(lender, borrowed.borrowedFrom.lineId);
    if (ll && ll.lentTo === borrower.id) {
      ll.lentTo = null;
      pushLog(G, `${borrower.name} returns lent logistics to ${lender.name}.`, true);
    }
  }
  borrower.logisticsLines.splice(idx, 1);
  return true;
}

function returnIdleBorrowedLines(G: GameState): void {
  for (const c of G.colonies) {
    const idle = c.logisticsLines.filter(
      (l) => l.kind === "borrowed" && l.route === null && (l.exportRoute == null || l.exportRoute === undefined)
    );
    for (const l of idle) returnLentLine(G, c, l.id);
  }
}

function claimColonyExport(
  G: GameState, actor: Colony, sourceColony: Colony, node: NodeType, importerLineId: string
): LogisticsLine | null {
  const eline = pickExportLine(sourceColony, actor, {
    reclaimImporterId: actor.id,
    reclaimImporterLineId: importerLineId,
  });
  if (!eline) return null;
  // Drop any prior export on this exporter line / prior export to this importer line
  clearExportToImporter(G, actor.id, importerLineId);
  eline.exportRoute = {
    colonyId: actor.id,
    colonyName: actor.name,
    node,
    importerLineId,
  };
  return eline;
}

export function startRoute(G: GameState, actor: Colony, lineId: string, source: TradeSource, rng: Rng): boolean {
  if (source.node === "Logistics") { pushLog(G, "Use Logistics import to gain a new line."); return false; }
  const line = findLine(actor, lineId);
  if (!line) { pushLog(G, "Unknown logistics line."); return false; }
  if (line.route !== null) { pushLog(G, `${line.name} import slot is occupied.`); return false; }
  if (line.lentTo) { pushLog(G, `${line.name} is lent away.`); return false; }
  if (!lineCanServeTrade(line, actor, source)) {
    pushLog(G, `${line.name} reach cannot serve that trade.`);
    return false;
  }
  if (!validateTradeSource(G, actor, source)) { pushLog(G, "That trade source is not available."); return false; }
  if (source.kind === "earth") {
    if (!claimEarthSlot(G, actor, source.bloc, source.slotIndex, source.node, rng)) return false;
  } else {
    if (!claimColonyExport(G, actor, source.colony, source.node, line.id)) {
      pushLog(G, `${source.colony.name} has no free export logistics slot.`);
      return false;
    }
    pushLog(G, `${actor.name} starts import of ${source.node} from ${source.colony.name} on ${line.name}.`, true);
  }
  const vital = isVitalNeed(actor, source.node); // before route applies (extras would cover basal)
  line.route = makeRoute(source);
  if (vital) line.route.vital = true;
  applyRouteStartEffects(G, actor, source, rng);
  if (source.node === actor.requires) develop(G, actor, rng);
  if (source.kind === "colony" && line.route.vital) {
    for (const sl of source.colony.logisticsLines) {
      if (sl.exportRoute?.colonyId === actor.id && sl.exportRoute.importerLineId === line.id) {
        sl.exportRoute.vital = true;
      }
    }
  }
  afterColonyAction(G, actor, rng);
  return true;
}

export function switchRoute(G: GameState, actor: Colony, lineId: string, source: TradeSource, rng: Rng): boolean {
  if (source.node === "Logistics") { pushLog(G, "Cannot switch onto Logistics — import Logistics instead."); return false; }
  const line = findLine(actor, lineId);
  if (!line) { pushLog(G, "Unknown logistics line."); return false; }
  if (line.route === null) { pushLog(G, `${line.name} is free — start a route instead.`); return false; }
  if (line.relay) { pushLog(G, "A relay carries only its Earth good — end it instead."); return false; }
  if (!lineCanServeTrade(line, actor, source)) {
    pushLog(G, `${line.name} reach cannot serve that trade.`);
    return false;
  }
  if (!validateTradeSource(G, actor, source, lineId)) { pushLog(G, "That trade source is not available."); return false; }
  const oldR = line.route;
  clearRouteOnLine(G, actor, line, rng, true);
  pushLog(G, `${actor.name} switches ${line.name}: ${oldR.node}←${oldR.sourceName} → ${source.node}←${sourceLabel(source)}.`, true);
  if (source.kind === "earth") {
    if (!claimEarthSlot(G, actor, source.bloc, source.slotIndex, source.node, rng)) {
      afterColonyAction(G, actor, rng); return false;
    }
  } else {
    if (!claimColonyExport(G, actor, source.colony, source.node, line.id)) {
      pushLog(G, `${source.colony.name} has no free export logistics slot.`);
      afterColonyAction(G, actor, rng); return false;
    }
  }
  const vital = isVitalNeed(actor, source.node);
  line.route = makeRoute(source);
  if (vital) line.route.vital = true;
  applyRouteStartEffects(G, actor, source, rng);
  if (source.node === actor.requires) develop(G, actor, rng);
  if (source.kind === "colony" && line.route.vital) {
    for (const sl of source.colony.logisticsLines) {
      if (sl.exportRoute?.colonyId === actor.id && sl.exportRoute.importerLineId === line.id) {
        sl.exportRoute.vital = true;
      }
    }
  }
  afterColonyAction(G, actor, rng);
  return true;
}

export function cancelRoute(G: GameState, actor: Colony, lineId: string, rng: Rng): boolean {
  const line = findLine(actor, lineId);
  if (!line || !line.route) { pushLog(G, "No active route on that line."); return false; }
  const wasBorrowed = line.kind === "borrowed";
  clearRouteOnLine(G, actor, line, rng, false);
  if (wasBorrowed) returnLentLine(G, actor, lineId);
  afterColonyAction(G, actor, rng);
  return true;
}

/** Lend a free ally line then start a normal import on the borrowed capacity. */
export function startRouteWithLend(
  G: GameState, actor: Colony, lenderId: string, lenderLineId: string, source: TradeSource, rng: Rng
): boolean {
  if (source.node === "Logistics") { pushLog(G, "Use Logistics import to gain a new line."); return false; }
  if (freeLineCount(actor) > 0) {
    const free = freeLines(actor).filter((l) => lineCanServeTrade(l, actor, source));
    if (free.length) return startRoute(G, actor, free[0]!.id, source, rng);
  }
  // Max 1 lend attempt per actor per turn (0.8.0) — no lend-fail-return loops
  if ((actor.lendAttemptsThisTurn || 0) >= 1) {
    pushLog(G, `${actor.name} already attempted a lend this turn.`);
    return false;
  }
  const lender = G.colonies.find((c) => c.id === lenderId);
  if (!lender) { pushLog(G, "Unknown lender colony."); return false; }
  const lenderLine = findLine(lender, lenderLineId);
  if (!lenderLine) { pushLog(G, "Unknown lender line."); return false; }
  // Reach must pass for intended import before lend
  if (!lineCanServeTrade(lenderLine, actor, source)) {
    pushLog(G, `${lenderLine.name} reach cannot serve that trade — lend blocked.`);
    actor.lendAttemptsThisTurn = (actor.lendAttemptsThisTurn || 0) + 1;
    return false;
  }
  actor.lendAttemptsThisTurn = (actor.lendAttemptsThisTurn || 0) + 1;
  const borrowed = lendLogisticsLine(G, lender, lenderLineId, actor);
  if (!borrowed) { pushLog(G, "That logistics line cannot be lent."); return false; }
  const ok = startRoute(G, actor, borrowed.id, source, rng);
  if (!ok) {
    returnLentLine(G, actor, borrowed.id);
  }
  return ok;
}

export function importLogistics(G: GameState, actor: Colony, source: TradeSource, rng: Rng): boolean {
  if (source.node !== "Logistics") { pushLog(G, "Not a Logistics import."); return false; }
  if (!validateTradeSource(G, actor, source)) { pushLog(G, "That Logistics source is not available."); return false; }
  // Mars needs Earth-sourced logistics for Earth reach — importing from Earth is always allowed by reach on the new line itself
  const label = sourceLabel(source);
  const newId = allocLineId(actor);
  (G as unknown as { __logiTrace?: { turn: number; kind: string; body: string }[] }).__logiTrace
    ?.push({ turn: G.turn, kind: source.kind, body: actor.body });
  if (source.kind === "earth") {
    if (!claimEarthSlot(G, actor, source.bloc, source.slotIndex, "Logistics", rng)) return false;
  } else {
    const eline = pickExportLine(source.colony, actor);
    if (!eline) { pushLog(G, `${source.colony.name} has no free export logistics slot.`); return false; }
    eline.exportRoute = {
      colonyId: actor.id, colonyName: actor.name, node: "Logistics", importerLineId: newId,
    };
    pushLog(G, `${actor.name} imports Logistics from ${source.colony.name} (+1 line).`, true);
  }
  actor.logisticsLines.push({
    id: newId,
    name: `Imported ${label} logistics`,
    kind: "import",
    sourceLabel: label,
    earthClaim: source.kind === "earth" ? { blocName: source.bloc.name, slotIndex: source.slotIndex } : undefined,
    colonySourceId: source.kind === "colony" ? source.colony.id : undefined,
    route: null,
    exportRoute: null,
    lentTo: null,
    reach: reachForLogisticsImport(source),
  });
  if (actor.requires === "Logistics") develop(G, actor, rng);
  afterColonyAction(G, actor, rng);
  return true;
}

export function cancelLogisticsImport(G: GameState, actor: Colony, lineId: string, rng: Rng): boolean {
  const idx = actor.logisticsLines.findIndex((l) => l.id === lineId);
  if (idx < 0) { pushLog(G, "Unknown logistics line."); return false; }
  const line = actor.logisticsLines[idx]!;
  if (line.kind !== "import") { pushLog(G, "Only imported Logistics lines can be cancelled this way."); return false; }
  if (line.route) clearRouteOnLine(G, actor, line, rng, true);
  if (line.exportRoute) {
    line.exportRoute = null;
    line.trojanExport = false;
  }
  if (line.earthClaim) {
    const b = blocByName(G, line.earthClaim.blocName);
    if (b) releaseEarthClaim(G, b, line.earthClaim.slotIndex, rng, actor.name);
  }
  if (line.colonySourceId) clearExportToImporter(G, actor.id, line.id);
  pushLog(G, `${actor.name} cancels ${line.name} (−1 logistics line).`, true);
  actor.logisticsLines.splice(idx, 1);
  afterColonyAction(G, actor, rng);
  return true;
}

/** Raw sources (availability only; no East/West or Subversion filters). */
/** 0.18.0 `marsMoonOnlyImports`: Mars colonies never trade with Earth directly. */
export function marsEarthless(G: GameState, c: Colony): boolean {
  if (c.body === "Belt") return true; // 0.20.0: the belt imports only from Mars
  return c.body === "Mars" && !!G.rules && ruleOn(G, "marsMoonOnlyImports");
}

export function findSourcesRaw(G: GameState, actor: Colony, node: NodeType): TradeSource[] {
  const out: TradeSource[] = [];
  if (!marsEarthless(G, actor)) for (const b of G.blocs) {
    const idx = findUnclaimedSlot(b, node);
    if (idx >= 0) out.push({ kind: "earth", bloc: b, node, slotIndex: idx });
  }
  for (const c of G.colonies) {
    if (c.id === actor.id) continue;
    if (extras(c, node) >= 1 && consentsExport(G, c, actor, node)) {
      out.push({ kind: "colony", colony: c, node });
    }
  }
  return out;
}

/** Legal trade sources after East/West vital+fair, export slots, Subversion gates. */
export function findSources(G: GameState, actor: Colony, node: NodeType): TradeSource[] {
  const out: TradeSource[] = [];
  for (const s of findSourcesRaw(G, actor, node)) {
    if (s.kind === "earth") {
      if (!earthTradeAllowed(
        G, actor, s.bloc, node, CULTURES, IDEOLOGIES, socialAffinity, consentsExport
      )) continue;
      // Must have some importer line that can reach (or Logistics import creates its own reach)
      if (node !== "Logistics") {
        const can = freeLines(actor).some((l) => lineCanServeTrade(l, actor, s))
          || occupiedLines(actor).some((l) => lineCanServeTrade(l, actor, s));
        // Also allow if actor could borrow — still need any line with reach; Mars w/o earth line blocked
        const anyLine = actor.logisticsLines.some((l) => !l.lentTo && lineCanServeTrade(l, actor, s));
        if (!anyLine && !can) continue;
      }
    } else {
      if (node === "Subversion" && !shouldAcceptEnemySubversion(G, actor, s)) continue;
      if (!pickExportLine(s.colony, actor)) continue;
      if (node !== "Logistics") {
        const anyLine = actor.logisticsLines.some((l) => !l.lentTo && lineCanServeTrade(l, actor, s));
        if (!anyLine) continue;
      } else {
        // Logistics import: importer body↔exporter body must be servable by exporter's export line
        if (!pickExportLine(s.colony, actor)) continue;
      }
    }
    out.push(s);
  }
  return out;
}

function patronAlliance(G: GameState, patron: string): Alliance | undefined {
  return blocByName(G, patron)?.alliance;
}
function rankSource(G: GameState, actor: Colony, s: TradeSource): number {
  if (s.kind === "earth") {
    const aA = isIndependent(actor) ? null : patronAlliance(G, actor.patron);
    // 0.8.2: legal Earth sources rank ahead of all colony sources (own / Neutral / same-alliance / vital+fair)
    if (!isIndependent(actor) && s.bloc.name === actor.patron) return -20;
    if (s.bloc.alliance === "Neutral") return -18;
    if (aA && s.bloc.alliance === aA) return -18;
    if (aA === "Neutral") return -16;
    if (aA === null) {
      const aff = earthBlocSocialAffinity(actor, s.bloc, CULTURES, IDEOLOGIES);
      return aff >= 1 ? -16 : -12;
    }
    return -10; // opposite vital+fair still ahead of colony
  }
  const aff = socialAffinity(G, actor, s.colony);
  // Colony after Earth; prefer intra-nation when affinity ties (0.8.0/0.8.2)
  const nationBonus = sameNation(actor, s.colony) ? 2 : 0;
  return 20 - aff - nationBonus;
}
/** Exported for tests — lower = better. */
export function rankTradeSource(G: GameState, actor: Colony, s: TradeSource): number {
  return rankSource(G, actor, s);
}
export function pickBestTradeSource(G: GameState, actor: Colony, sources: TradeSource[]): TradeSource | null {
  return pickBestSource(G, actor, sources);
}
function pickBestSource(G: GameState, actor: Colony, sources: TradeSource[]): TradeSource | null {
  if (!sources.length) return null;
  sources.sort((a, b) => rankSource(G, actor, a) - rankSource(G, actor, b));
  return sources[0]!;
}


/** Cancel earthCycle probe routes at start of colony action (0.8.2) — frees/rerolls Earth excess. */
export function cancelEarthCycleRoutes(G: GameState, actor: Colony, rng: Rng): number {
  let n = 0;
  for (const line of actor.logisticsLines) {
    if (!line.route?.earthCycle) continue;
    // Never cancel vital Requires routes even if mis-tagged
    if (line.route.vital || line.route.node === actor.requires) {
      line.route.earthCycle = false;
      continue;
    }
    pushLog(G, `${actor.name} ends Earth cycle of ${line.route.node} from ${line.route.sourceName} (reroll for growth).`, true);
    clearRouteOnLine(G, actor, line, rng, true);
    n += 1;
  }
  return n;
}

/** Probe-import a non-vital Earth excess to drive slot fill → new excess unlock (0.8.2). */
export function tryEarthCycle(G: GameState, actor: Colony, rng: Rng): boolean {
  if (marsEarthless(G, actor)) return false;
  if (actor.logisticsLines.some((l) => l.route?.earthCycle)) return false;
  const free = freeLines(actor).filter((l) => l.kind !== "borrowed" && !l.lentTo);
  if (!free.length) return false;
  const probes: TradeSource[] = [];
  for (const b of G.blocs) {
    for (let i = 0; i < b.excess.length; i++) {
      const slot = b.excess[i]!;
      if (slot.claimedBy !== null) continue;
      if (slot.node === "Logistics") continue;
      if (isVitalNeed(actor, slot.node)) continue;
      const s: TradeSource = { kind: "earth", bloc: b, node: slot.node, slotIndex: i };
      if (!earthTradeAllowed(
        G, actor, b, slot.node, CULTURES, IDEOLOGIES, socialAffinity, consentsExport
      )) continue;
      if (!free.some((l) => lineCanServeTrade(l, actor, s))) continue;
      probes.push(s);
    }
  }
  if (!probes.length) return false;
  const best = pickBestSource(G, actor, probes);
  if (!best || best.kind !== "earth") return false;
  const line = free.find((l) => lineCanServeTrade(l, actor, best));
  if (!line) return false;
  // Inline start without develop (node is non-vital / not Requires)
  if (!claimEarthSlot(G, actor, best.bloc, best.slotIndex, best.node, rng)) return false;
  line.route = makeRoute(best);
  line.route.earthCycle = true;
  applyRouteStartEffects(G, actor, best, rng);
  pushLog(G, `${actor.name} cycles Earth excess for growth (${best.node} from ${best.bloc.name} on ${line.name}).`, true);
  afterColonyAction(G, actor, rng);
  return true;
}

/** Intra-nation feed: export Requires/basal surplus to hungriest same-nation sibling. */
export function tryFeedHungrySibling(G: GameState, actor: Colony, rng: Rng): boolean {
  const canExport = actor.logisticsLines.some(
    (l) => !l.exportRoute && !l.lentTo && l.kind !== "borrowed" && !l.trojanExport
  );
  if (!canExport) return false;
  type Cand = { sibling: Colony; node: NodeType; score: number };
  const cands: Cand[] = [];
  for (const sib of G.colonies) {
    if (sib.id === actor.id || !sameNation(actor, sib)) continue;
    const free = freeLines(sib);
    if (!free.length) continue;
    const nodes: NodeType[] = [sib.requires, ...BASAL_NODES.filter((n) => extras(sib, n) <= 0)];
    const seen = new Set<NodeType>();
    for (const node of nodes) {
      if (seen.has(node)) continue;
      seen.add(node);
      if (extras(actor, node) < 1) continue;
      const src = { kind: "colony" as const, colony: actor, node };
      if (!free.some((l) => lineCanServeTrade(l, sib, src))) continue;
      if (!pickExportLine(actor, sib)) continue;
      let score = needScore(sib);
      if (node === sib.requires) score += 20;
      cands.push({ sibling: sib, node, score });
    }
  }
  if (!cands.length) return false;
  cands.sort((a, b) => b.score - a.score || a.sibling.name.localeCompare(b.sibling.name));
  const pick = cands[0]!;
  const free = freeLines(pick.sibling).find((l) =>
    lineCanServeTrade(l, pick.sibling, { kind: "colony", colony: actor, node: pick.node })
  );
  if (!free) return false;
  const ok = grantColonyImport(G, pick.sibling, free.id, actor, pick.node, rng);
  if (ok) {
    pushLog(G, `${actor.name} feeds sibling ${pick.sibling.name} with ${pick.node} (intra-nation).`, true);
    afterColonyAction(G, actor, rng);
    return true;
  }
  return false;
}

export function autoAct(G: GameState, actor: Colony, rng: Rng): void {
  if (actor.acted) return;
  (G as unknown as { __actTrace?: { turn: number; id: string; rp: number; level: number }[] }).__actTrace
    ?.push({ turn: G.turn, id: actor.id, rp: rp(actor, G.bodyTF), level: colonyLevel(actor) });
  refreshBeltReach(G); // 0.20.0 Thrust reach (lines → belt)
  // 0.19.0: nomad camps only raid / settle
  if (actor.nomad) { crises.campAct(G, actor, rng); actor.acted = true; return; }
  // 0.8.2: cancel prior-turn earthCycle probes so Earth excess rerolls
  cancelEarthCycleRoutes(G, actor, rng);
  // 0.19.0 oxygen wars: the crisis colony pleads / threatens / seizes first
  if (actor.oxygenCrisis && crises.runOxygenCrisis(G, actor, rng)) { actor.acted = true; return; }
  const spread = !!G.rules && ruleOn(G, "aiSpreadDevelop");
  const lendAllies = !!G.rules && ruleOn(G, "aiLendAllies");
  const loop = !!G.rules && ruleOn(G, "aiLogisticsLoop");
  const earthless = marsEarthless(G, actor);
  const active = !!G.rules && ruleOn(G, "aiActiveEarth");
  /** Requires sources minus those left to smaller friends (aiSpreadDevelop). */
  const sourcesFor = (node: NodeType): TradeSource[] => {
    const all = findSources(G, actor, node);
    if (!spread || node !== actor.requires || node === "Logistics") return all;
    const reserved = reservedForSmallerFriends(G, actor, node);
    return reserved.size ? all.filter((s) => !reserved.has(tradeSourceKey(s))) : all;
  };
  const tryStart = (node: NodeType): boolean => {
    if (node === "Logistics") {
      let sources = findSources(G, actor, "Logistics");
      // Mars needs Earth-sourced Logistics for Earth reach — ignore Moon/Mars Logistics here
      if (actor.body === "Mars" && !hasEarthReach(actor) && !earthless) {
        sources = sources.filter((s) => s.kind === "earth");
      }
      const best = pickBestSource(G, actor, sources);
      return best ? importLogistics(G, actor, best, rng) : false;
    }
    const best = pickBestSource(G, actor, sourcesFor(node));
    if (!best) return crises.tryRelay(G, actor, node, rng); // 0.19.0: e.g. Earth goods to Mars via a Moon relay
    const free = freeLines(actor).filter((l) => lineCanServeTrade(l, actor, best));
    const ownFree = free.filter((l) => l.kind !== "borrowed");
    if (ownFree.length) return startRoute(G, actor, ownFree[0]!.id, best, rng);
    if (free.length) return startRoute(G, actor, free[0]!.id, best, rng);
    // No free lines: one reach-aware lend attempt max (0.19.0: else ask for a relay)
    if ((actor.lendAttemptsThisTurn || 0) >= 1) return crises.tryRelay(G, actor, node, rng);
    // 0.17.1 spread: never *ask* a colony ≥ gap levels smaller for a line (anti-hoarding, 0.18.0: lenders still always lend to allies who ask)
    const lender = pickBestLender(G, actor, best, spread ? colonyLevel(actor) - ruleNum(G, "aiSpreadGap") + 1 : 0);
    if (!lender) return crises.tryRelay(G, actor, node, rng);
    if (lender.clearRoute && lender.line.route) {
      pushLog(G, `${lender.colony.name} frees ${lender.line.name} (${lender.line.route.node}) for ally ${actor.name}.`, true);
      clearRouteOnLine(G, lender.colony, lender.line, rng, true);
    }
    return startRouteWithLend(G, actor, lender.colony.id, lender.line.id, best, rng);
  };
  const trySwitch = (node: NodeType): boolean => {
    if (node === "Logistics") return false;
    const best = pickBestSource(G, actor, sourcesFor(node));
    if (!best) return false;
    // 0.19.0: a line relaying its Earth good to a partner is not switched away
    const candidates = occupiedLines(actor).filter(
      (l) => l.route && l.route.node !== actor.requires && lineCanServeTrade(l, actor, best)
    );
    const line = candidates[0] ?? occupiedLines(actor).find((l) => lineCanServeTrade(l, actor, best));
    if (!line || (line.route && line.route.node === node)) return false;
    return switchRoute(G, actor, line.id, best, rng);
  };
  const needNodes = (): NodeType[] => {
    const out: NodeType[] = [];
    // 0.8.1: Mars without Earth reach — Logistics (Earth) first so Needs can be filled
    if (actor.body === "Mars" && !hasEarthReach(actor) && !earthless) {
      out.push("Logistics");
    }
    out.push(actor.requires);
    for (const d of DEPS[actor.requires] || []) {
      if (extras(actor, d) <= 0 && actor.specialty !== d && !out.includes(d)) out.push(d);
    }
    for (const n of BASAL_NODES) {
      if (extras(actor, n) <= 0 && !out.includes(n)) out.push(n);
    }
    for (const n of strainedNodes(actor)) {
      for (const d of missingDepsOf(actor, n)) {
        if (!out.includes(d)) out.push(d);
      }
    }
    // 0.18.0: scaled survival shortfalls are critical needs too (Population > cover)
    if (loop && G.rules && ruleOn(G, "survivalScaledCover")) {
      for (const r of SURVIVAL_RESOURCES) if (survivalShortfall(G, actor, r) > 0 && !out.includes(r)) out.push(r);
    }
    return out;
  };
  // 0) Mars unlock: prefer Earth-sourced Logistics before anything else (not with 0.18.0 Moon-only Mars)
  if (actor.body === "Mars" && !hasEarthReach(actor) && !earthless) {
    const earthLog = findSources(G, actor, "Logistics").filter((s) => s.kind === "earth");
    if (earthLog.length) {
      const best = pickBestSource(G, actor, earthLog);
      if (best && importLogistics(G, actor, best, rng)) return;
    }
  }
  // 0a) 0.17.1 spread: take back a line lent to a much bigger colony (non-vital use) if it lets us develop
  if (spread || lendAllies) tryRecallLentLine(G, actor, rng);
  // 0b) 0.17.1 spread: a much bigger colony first helps a smaller friend develop from its own surplus
  if (spread && tryFeedFriendRequires(G, actor, rng, colonyLevel(actor) - ruleNum(G, "aiSpreadGap"))) return;
  // 1) Fill Requires / missing basals / strained deps — never pass if sourcable
  for (const n of needNodes()) {
    if (tryStart(n)) return;
  }
  // 2) Prefer switch over pass for Needs
  for (const n of needNodes()) {
    if (trySwitch(n)) return;
  }
  // 3) Independent founding (0.8.1): cooldown + RP + basal/Money surplus; feed when 2+ cities
  if (isIndependent(actor) && foundingCooldownReady(G) && strainOf(actor) <= 3 && rp(actor, G.bodyTF) >= 3) {
    const liegeId = actor.liegeId || actor.id;
    const nationSize = G.colonies.filter(
      (c) => c.patron === INDEPENDENT_PATRON && (c.liegeId || c.id) === liegeId
    ).length;
    const hasFeed =
      extras(actor, "Money") >= 1 || BASAL_NODES.some((n) => extras(actor, n) >= 1);
    // Soft cap: autoAct Independent founds stop after 3 cities in the liege nation
    if (hasFeed && nationSize < 4) {
      if (!canIndependentFound(actor) && rp(actor, G.bodyTF) >= 5) {
        tryFreeLineForIndependentFound(G, actor, rng);
      }
      if (canIndependentFound(actor) && tryIndependentFound(G, actor, rng)) {
        const child = G.colonies[G.colonies.length - 1]!;
        if (child && child.patron === INDEPENDENT_PATRON) tryFeedNewColony(G, child, rng);
        afterColonyAction(G, actor, rng);
        return;
      }
    }
  }
  // 4) Trojan send rare (0.8.3 reverse logistics) — only with Subversion excess + ~10%
  const trojans = listTrojanTargets(G, actor);
  if (trojans.length && extras(actor, "Subversion") >= 1 && chance(rng, 0.1)) {
    const t = trojans[0]!;
    if (executeTrojanSend(G, actor, t.victim, t.attackerLine.id)) {
      afterColonyAction(G, actor, rng);
      return;
    }
  }
  // 4b) Bilateral counter propose/accept
  if (maybeAutoCounter(G, actor, rng)) {
    /* non-acting soft */ 
  }
  // Final Needs re-check before pass (never pass if Requires / basals sourcable)
  for (const n of needNodes()) {
    if (sourcesFor(n).length) {
      if (tryStart(n)) return;
      if (trySwitch(n)) return;
    }
  }
  // Intra-nation feed before pass (0.8.1)
  if (tryFeedHungrySibling(G, actor, rng)) return;
  // 0.18.0 Logistics loop (Tiago): Earth Logistics (+1 line, kept) → keep cycling → fill friendly Earth blocs
  if (loop) {
    if (tryImportLogisticsForCapacity(G, actor, rng)) return;
    // spare lines (≥ 2 free: one stays free for cycling) fill friendly blocs; otherwise keep cycling
    const ownFree = freeLines(actor).filter((l) => l.kind !== "borrowed" && !l.lentTo).length;
    if (ownFree >= 2 && tryFillFriendlyEarth(G, actor, rng)) return;
    if (tryEarthCycle(G, actor, rng)) return;
    if (tryFillFriendlyEarth(G, actor, rng)) return;
  }
  // 0.8.2: Earth probe cycle when free logistics + no urgent Earth Need left
  if (tryEarthCycle(G, actor, rng)) return;
  // L4 rare invade (Military token + hostile same-body)
  if (maybeAutoInvade(G, actor, rng)) {
    afterColonyAction(G, actor, rng);
    return;
  }
  // 0.17.1 aiActiveEarth: work Earth / help allies before passing
  if (active) {
    if (tryImportLogisticsForCapacity(G, actor, rng)) return;
    if (tryCoopEarthUnlock(G, actor, rng)) return;
    if (tryFeedFriendRequires(G, actor, rng, Number.POSITIVE_INFINITY)) return;
  }
  const ptrace = (G as unknown as { __passTrace?: PassDiag[] }).__passTrace;
  if (ptrace) ptrace.push(diagnosePass(G, actor));
  pushLog(G, `${actor.name} passes.`);
  afterColonyAction(G, actor, rng);
}

// ── 0.17.1 debug: why did an AI colony pass? (probe only; set `G.__passTrace = []`) ──────────────
export interface PassDiag {
  turn: number; id: string; patron: string; level: number; rp: number;
  freeLines: number; totalLines: number;
  /** Primary reason (Requires growth path). */
  reason: string;
  /** Earth cycle: why tryEarthCycle could not run. */
  cycle: string;
  /** Own sovereign / allied Earth bloc has unclaimed slots the actor could claim with a line it could free (switch a non-vital route). */
  coopBySwitch: boolean;
  /** An allied (same alliance, other nation) colony needs this actor's Requires-surplus and has a free line. */
  allyFeed: boolean;
  /** Requires source exists, but only via occupied lines (switching a non-vital route would develop). */
  reqBySwitch: boolean;
}
export function diagnosePass(G: GameState, actor: Colony): PassDiag {
  const R = actor.requires;
  const raw = findSourcesRaw(G, actor, R);
  const legal = findSources(G, actor, R);
  const free = freeLines(actor).filter((l) => l.kind !== "borrowed" && !l.lentTo);
  let reason: string;
  if (!raw.length) {
    const earthHasClaimed = G.blocs.some((b) => b.excess.some((x) => x.node === R && x.claimedBy !== null));
    const colonyHas = G.colonies.some((c) => c.id !== actor.id && extras(c, R) >= 1);
    reason = colonyHas ? "req_colony_refuses" : earthHasClaimed ? "req_earth_all_claimed" : "req_nowhere";
  } else if (!legal.length) {
    const earthRaw = raw.filter((x) => x.kind === "earth");
    const affinityBlocked = earthRaw.some((x) => x.kind === "earth" && !earthTradeAllowed(G, actor, x.bloc, R, CULTURES, IDEOLOGIES, socialAffinity, consentsExport));
    reason = affinityBlocked ? "req_trade_locked_bloc" : "req_reach_or_export_slot";
  } else {
    reason = free.length ? "req_start_failed" : "req_no_free_line";
  }
  // Earth cycle diagnosis (mirrors tryEarthCycle)
  let cycle = "cycle_impossible_other";
  if (!free.length) cycle = "cycle_no_free_line";
  else {
    let anyUnclaimed = false, anyNonVital = false, anyAllowed = false, anyReach = false;
    for (const b of G.blocs) b.excess.forEach((slot, i) => {
      if (slot.claimedBy !== null || slot.node === "Logistics") return;
      anyUnclaimed = true;
      if (isVitalNeed(actor, slot.node)) return;
      anyNonVital = true;
      if (!earthTradeAllowed(G, actor, b, slot.node, CULTURES, IDEOLOGIES, socialAffinity, consentsExport)) return;
      anyAllowed = true;
      const src: TradeSource = { kind: "earth", bloc: b, node: slot.node, slotIndex: i };
      if (free.some((l) => lineCanServeTrade(l, actor, src))) anyReach = true;
    });
    cycle = !anyUnclaimed ? "cycle_no_unclaimed_slot" : !anyNonVital ? "cycle_only_vital_slots"
      : !anyAllowed ? "cycle_trade_locked" : !anyReach ? "cycle_no_reach" : "cycle_possible_not_chosen";
  }
  const allies = (b: EarthBloc) => !isIndependent(actor) && (b.name === actor.patron || (patronAllianceOf(G, actor) && b.alliance === patronAllianceOf(G, actor)));
  const switchable = occupiedLines(actor).filter((l) => l.route && !l.route.vital && !isVitalNeed(actor, l.route.node) && l.route.node !== R && l.kind !== "borrowed");
  const coopBySwitch = switchable.length > 0 && G.blocs.some((b) => allies(b) && b.excess.some((slot, i) =>
    slot.claimedBy === null && slot.node !== "Logistics"
    && earthTradeAllowed(G, actor, b, slot.node, CULTURES, IDEOLOGIES, socialAffinity, consentsExport)
    && switchable.some((l) => lineCanServeTrade(l, actor, { kind: "earth", bloc: b, node: slot.node, slotIndex: i }))));
  const reqBySwitch = legal.length > 0 && !free.length && switchable.some((l) => legal.some((src) => lineCanServeTrade(l, actor, src)));
  const aAll = patronAllianceOf(G, actor);
  const allyFeed = !!aAll && G.colonies.some((o) => o.id !== actor.id && !sameNation(o, actor) && patronAllianceOf(G, o) === aAll
    && extras(actor, o.requires) >= 1 && freeLines(o).length > 0 && !!pickExportLine(actor, o));
  return {
    turn: G.turn, id: actor.id, patron: actor.patron, level: colonyLevel(actor), rp: rp(actor, G.bodyTF),
    freeLines: free.length, totalLines: actor.logisticsLines.length, reason, cycle, coopBySwitch, allyFeed, reqBySwitch,
  };
}

/** Free one non-vital non-base line so Independent can spend it on founding. */
export function tryFreeLineForIndependentFound(G: GameState, actor: Colony, rng: Rng): boolean {
  if (!isIndependent(actor)) return false;
  if (canIndependentFound(actor)) return true;
  const cands = actor.logisticsLines.filter(
    (l) =>
      l.kind !== "base" &&
      l.kind !== "borrowed" &&
      !l.lentTo &&
      !l.trojanExport &&
      l.route !== null &&
      l.route.node !== actor.requires &&
      !l.route.vital &&
      !isVitalNeed(actor, l.route.node)
  );
  cands.sort((a, b) => a.name.localeCompare(b.name));
  const line = cands[0];
  if (!line) return false;
  clearRouteOnLine(G, actor, line, rng, false);
  pushLog(G, `${actor.name} frees ${line.name} for Independent founding.`, true);
  return canIndependentFound(actor);
}

/** Nodes a nation's existing cities can currently export as newborn feed. */
export function nationFeedableNodes(G: GameState, patron: string): NodeType[] {
  const out: NodeType[] = [];
  const seen = new Set<string>();
  for (const c of G.colonies) {
    if (c.patron !== patron) continue;
    for (const n of [...BASAL_NODES, "Money" as NodeType]) {
      if (extras(c, n) >= 1 && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
  }
  return out;
}

/** Bias requires toward what a sibling can actually feed (0.8.1). */
export function rollSpecialtyRequiresForPatron(
  G: GameState, patron: string, rng: Rng
): { specialty: NodeType; requires: NodeType } {
  const feedable = nationFeedableNodes(G, patron);
  if (feedable.length) {
    const requires = pick(rng, feedable);
    const specialty = pick(rng, NODES.filter((n) => n !== requires));
    return { specialty, requires };
  }
  return rollSpecialtyRequires(rng, G.gameMode);
}

export function tryFound(G: GameState, rng: Rng): boolean {
  if (!foundingCooldownReady(G)) return false;
  const ready = G.blocs.filter((b) => {
    if (!canBlocFound(b)) return false;
    const tax = foundingTax(b);
    const canPay = b.tech >= tax || isUncappedFounder(b.name);
    if (!canPay && !isUncappedFounder(b.name)) return false;
    // 0.8.1: allow one underfed expansion (starter→2nd); 3rd+ needs sibling feed
    const existing = G.colonies.filter((c) => c.patron === b.name).length;
    if (existing >= 2 && !hasNationFeedSurplus(G, b.name)) return false;
    return true;
  }).sort((a, b) => b.tech - a.tech || a.name.localeCompare(b.name));
  if (!ready.length) return false;
  const winner = ready[0]!;
  const body = foundingBodyFor(G, winner.name, socialAffinity);
  const { specialty, requires } = rollSpecialtyRequiresForPatron(G, winner.name, rng);
  const col = makeColony(G, {
    patron: winner.name, body, specialty, requires,
    culture: [CULTURES[winner.name] || "Mixed"],
    ideology: [IDEOLOGIES[winner.name] || "Localism"],
    rng,
  });
  const tax = foundingTax(winner);
  G.colonies.push(col);
  winner.colonies += 1;
  winner.tech = Math.max(0, winner.tech - tax);
  G.lastFoundTurn = G.turn;
  const capLabel = isUncappedFounder(winner.name) ? `${winner.tech} (uncapped)` : `${winner.tech}/${winner.cap}`;
  pushLog(G, `${winner.name} founds ${col.name} on ${body} [${specialty}, needs ${requires}]. Founding tax ${tax}; tech now ${capLabel}.`, true);
  G.pendingFoundings.push({ patron: winner.name, colonyName: col.name, body, turn: G.turn });
  tryFeedNewColony(G, col, rng);
  return true;
}

export function earthSpontaneous(G: GameState, rng: Rng): void {
  for (const b of G.blocs) {
    // Colonial players (at/past Earth develop cap, or uncapped founders) no longer
    // gain spontaneous tech or emit log spam.
    if (canBlocFound(b)) continue;
    if (b.tech >= b.cap) continue;
    if (chance(rng, 0.5)) {
      b.tech = Math.min(b.cap, b.tech + 1);
      pushLog(G, `${b.name} spontaneous tech → ${b.tech}/${b.cap}.`);
    }
  }
}

/** 0.20.0 Thrust = line reach: mark which lines reach the belt (owner, or lender for lent/relayed lines, has belt Thrust). */
export function refreshBeltReach(G: GameState): void {
  if (!G.rules || !ruleOn(G, "beltColonies")) return;
  const ok = new Map(G.colonies.map((c) => [c.id, beltReachOf(G, c)]));
  for (const c of G.colonies) {
    for (const l of c.logisticsLines) {
      const owner = l.kind === "borrowed" && l.borrowedFrom ? l.borrowedFrom.colonyId : c.id;
      // a belt colony's base line is the founding ship: it always reaches Mars
      const v = (c.body === "Belt" && l.kind === "base") || (ok.get(owner) ?? false);
      if (v) l.beltOk = true; else if (l.beltOk) delete l.beltOk;
    }
  }
}
/** 0.20.0 milestone: an Earth bloc's first belt colony gives the bloc + tech. */
function beltMilestones(G: GameState): void {
  if (!G.rules || !ruleOn(G, "beltColonies") || !ruleOn(G, "beltMilestone")) return;
  for (const c of G.colonies) {
    if (c.body !== "Belt" || c.nomad || isIndependent(c)) continue;
    const done = (G.beltMilestones ??= []);
    if (done.includes(c.patron)) continue;
    done.push(c.patron);
    const b = blocByName(G, c.patron);
    const bonus = ruleNum(G, "beltMilestoneTech");
    if (b) b.tech += bonus;
    pushLog(G, `🚀 BELT MILESTONE: ${c.patron} reaches the asteroid belt with ${c.name} (+${bonus} bloc tech).`, true);
    G.turnAnnouncements.push(`${c.patron} reaches the asteroid belt (+${bonus} tech).`);
  }
}

export function cleanup(G: GameState, _rng?: Rng): void {
  returnIdleBorrowedLines(G);
  crises.sweepCrises(G);
  beltMilestones(G);
  for (const c of G.colonies) {
    c.acted = false;
    c.lendAttemptsThisTurn = 0;
  }
}

function flushFoundings(G: GameState): void {
  G.turnAnnouncements = [];
  for (const f of G.pendingFoundings) {
    const bodyName = f.body === "Moon" ? "the Moon" : f.body === "Belt" ? "the asteroid belt" : "Mars";
    const msg = `${f.patron} founded ${f.colonyName} on ${bodyName}.`;
    G.turnAnnouncements.push(msg);
    pushLog(G, msg, true);
  }
  G.pendingFoundings = [];
}

export function startTurn(G: GameState, rng: Rng): void {
  pushLog(G, `— Turn ${G.turn} —`, true);
  // 0.18.0 (Tiago): the British Commonwealth starts Neutral (rules are applied after createGame)
  if (G.turn === 1 && G.rules && ruleOn(G, "bcNeutral")) {
    const bc = blocByName(G, "British Commonwealth");
    if (bc && bc.alliance === "West") bc.alliance = "Neutral";
  }
  flushFoundings(G);
  earthSpontaneous(G, rng);
}

export function finishTurn(G: GameState, rng: Rng, autoPassRemaining = false): void {
  if (autoPassRemaining) {
    for (const c of sortedColonies(G)) {
      if (!c.acted) {
        pushLog(G, `${c.name} passes.`);
        afterColonyAction(G, c, rng);
      }
    }
  }
  // 0.8.0: pressure ≥ 1 can shift alliances
  evaluateAllianceShifts(G, CULTURES, IDEOLOGIES, pushLog, false);
  maybeVitalRouteCuts(G, rng);
  tryRelationFoundSolarBloc(G, rng);
  tickProjects(G, rng, pushLog);
  tickGeopolitics(G, rng, pushLog);
  tryFound(G, rng);
  decayThreatTrack(G);
  cleanup(G, rng);
  G.turn += 1;
}

export function runTurn(G: GameState, rng: Rng): void {
  startTurn(G, rng);
  for (const c of sortedColonies(G)) autoAct(G, c, rng);
  finishTurn(G, rng, false);
}
export function runTurns(G: GameState, turns: number, rng: Rng): void {
  for (let i = 0; i < turns; i++) runTurn(G, rng);
}

export function getActingColony(G: GameState): Colony | null {
  for (const c of sortedColonies(G)) if (!c.acted) return c;
  return null;
}

export function listMoves(G: GameState, actor: Colony): PlayerMove[] {
  const moves: PlayerMove[] = [];
  const seen = new Set<string>();
  const pushU = (m: PlayerMove) => {
    const k = moveKey(m);
    if (!seen.has(k)) { seen.add(k); moves.push(m); }
  };
  for (const s of findSources(G, actor, "Logistics")) pushU({ kind: "import-logistics", source: s });
  const ownFree = freeLines(actor);
  for (const line of ownFree) {
    for (const n of NODES) {
      if (n === "Logistics") continue;
      for (const s of findSources(G, actor, n)) {
        if (!lineCanServeTrade(line, actor, s)) continue;
        pushU({ kind: "start", lineId: line.id, source: s });
      }
    }
  }
  // Lend-backed imports when actor has no free own lines
  if (ownFree.length === 0) {
    const lenders: LenderPick[] = [];
    for (const c of G.colonies) {
      if (c.id === actor.id) continue;
      if (!assistsColony(G, c, actor)) continue;
      for (const line of lendableLines(c)) {
        lenders.push({ colony: c, line, affinity: socialAffinity(G, c, actor) });
      }
    }
    lenders.sort((a, b) => b.affinity - a.affinity || a.colony.name.localeCompare(b.colony.name));
    // Cap: one best line per lender colony for move list
    const seenLender = new Set<string>();
    for (const L of lenders) {
      if (seenLender.has(L.colony.id)) continue;
      seenLender.add(L.colony.id);
      for (const n of NODES) {
        if (n === "Logistics") continue;
        for (const s of findSources(G, actor, n)) {
          // Borrowed line inherits lender reach
          if (!lineCanServeTrade(L.line, actor, s)) continue;
          pushU({ kind: "start-lend", lenderId: L.colony.id, lenderLineId: L.line.id, source: s });
        }
      }
    }
  }
  for (const line of occupiedLines(actor)) {
    for (const n of NODES) {
      if (n === "Logistics") continue;
      for (const s of findSources(G, actor, n)) {
        if (line.route && line.route.node === s.node && line.route.sourceId === sourceIdOf(s)) continue;
        if (!lineCanServeTrade(line, actor, s)) continue;
        pushU({ kind: "switch", lineId: line.id, source: s });
      }
    }
    pushU({ kind: "cancel-route", lineId: line.id });
  }
  for (const line of actor.logisticsLines) {
    if (line.kind === "import") pushU({ kind: "cancel-logistics-import", lineId: line.id });
  }
  if (canIndependentFound(actor)) {
    pushU({ kind: "found-colony" });
  }
  // Cancel Trojan send lines
  for (const line of actor.logisticsLines) {
    if (line.trojanSend) pushU({ kind: "cancel-trojan-send", lineId: line.id });
  }
  // Bilateral counter: pending consent as importer; propose as exporter
  for (const line of actor.logisticsLines) {
    if (line.route?.sourceKind === "colony" && line.route.counterNode && !line.route.counterConsent) {
      pushU({ kind: "counter-consent", lineId: line.id, accept: true });
      pushU({ kind: "counter-consent", lineId: line.id, accept: false });
    }
  }
  for (const line of actor.logisticsLines) {
    const er = line.exportRoute;
    if (!er || line.trojanSend) continue;
    const imp = G.colonies.find((c) => c.id === er.colonyId);
    if (!imp) continue;
    const iLine = findLine(imp, er.importerLineId);
    if (!iLine?.route || iLine.route.counterNode) continue;
    if (!colonyTradeOk(G, actor, imp)) continue;
    for (const n of NODES) {
      if (n === "Logistics" || n === iLine.route.node) continue;
      if (extras(imp, n) < 1) continue;
      if (extras(actor, n) > 0 && n !== actor.requires && !BASAL_NODES.includes(n as typeof BASAL_NODES[number])) continue;
      // Only propose Needs
      if (n !== actor.requires && extras(actor, n) > 0) continue;
      if (n === actor.requires || extras(actor, n) <= 0) {
        pushU({ kind: "counter-request", lineId: iLine.id, counterNode: n });
      }
    }
  }
  // Trojan send moves — cap 3, affinity ≤ 1 only (listTrojanTargets)
  let trojanCount = 0;
  for (const t of listTrojanTargets(G, actor)) {
    if (trojanCount >= 3) break;
    pushU({
      kind: "trojan",
      victimId: t.victim.id,
      node: t.node,
      attackerLineId: t.attackerLine.id,
      victimLineId: t.victimLine.id,
    });
    trojanCount += 1;
  }
  // L4 invade — cross-nation same body, Military token
  for (const def of listInvadeTargets(G, actor)) {
    pushU({ kind: "invade", defenderId: def.id });
  }
  moves.sort((a, b) => {
    const srcNode = (m: PlayerMove): NodeType | null =>
      m.kind === "cancel-route" || m.kind === "cancel-logistics-import" || m.kind === "found-colony"
        || m.kind === "cancel-trojan-send" || m.kind === "counter-consent" || m.kind === "invade"
        ? null
        : m.kind === "trojan" ? m.node
        : m.kind === "counter-request" ? m.counterNode
        : m.source.node;
    const nA = srcNode(a), nB = srcNode(b);
    const aR = nA === actor.requires ? 0 : 1;
    const bR = nB === actor.requires ? 0 : 1;
    if (aR !== bR) return aR - bR;
    const ko = (m: PlayerMove) =>
      m.kind === "start" || m.kind === "start-lend" ? 0
        : m.kind === "import-logistics" ? 1
        : m.kind === "switch" ? 2
        : m.kind === "found-colony" ? 3
        : m.kind === "counter-request" || m.kind === "counter-consent" ? 4
        : m.kind === "trojan" ? 5
        : m.kind === "invade" ? 5.5 : 6;
    const k = ko(a) - ko(b);
    if (k !== 0) return k;
    const hasSrc = (m: PlayerMove): m is PlayerMove & { source: TradeSource } =>
      m.kind === "start" || m.kind === "start-lend" || m.kind === "switch" || m.kind === "import-logistics";
    // counter/trojan/cancel lack source
    if (hasSrc(a) && hasSrc(b)) {
      return rankSource(G, actor, a.source) - rankSource(G, actor, b.source);
    }
    return 0;
  });
  return moves;
}

export function applyMove(G: GameState, actor: Colony, move: PlayerMove, rng: Rng): boolean {
  switch (move.kind) {
    case "start": return startRoute(G, actor, move.lineId, move.source, rng);
    case "start-lend": return startRouteWithLend(G, actor, move.lenderId, move.lenderLineId, move.source, rng);
    case "switch": return switchRoute(G, actor, move.lineId, move.source, rng);
    case "cancel-route": return cancelRoute(G, actor, move.lineId, rng);
    case "cancel-logistics-import": return cancelLogisticsImport(G, actor, move.lineId, rng);
    case "import-logistics": return importLogistics(G, actor, move.source, rng);
    case "found-colony": {
      const ok = tryIndependentFound(G, actor, rng);
      if (ok) {
        const child = G.colonies[G.colonies.length - 1]!;
        if (child && child.patron === INDEPENDENT_PATRON) tryFeedNewColony(G, child, rng);
        afterColonyAction(G, actor, rng);
      }
      return ok;
    }
    case "trojan": {
      const victim = G.colonies.find((c) => c.id === move.victimId);
      if (!victim) return false;
      const ok = executeTrojanSend(G, actor, victim, move.attackerLineId);
      if (ok) afterColonyAction(G, actor, rng);
      return ok;
    }
    case "cancel-trojan-send": {
      const ok = cancelTrojanSend(G, actor, move.lineId);
      if (ok) afterColonyAction(G, actor, rng);
      return ok;
    }
    case "counter-request": {
      const ok = requestCounterTrade(G, actor, move.lineId, move.counterNode);
      if (ok) afterColonyAction(G, actor, rng);
      return ok;
    }
    case "counter-consent": {
      const ok = consentCounterTrade(G, actor, move.lineId, move.accept);
      if (ok) afterColonyAction(G, actor, rng);
      return ok;
    }
    case "invade": {
      const def = G.colonies.find((c) => c.id === move.defenderId);
      if (!def) return false;
      const ok = invade(G, actor, def, rng);
      if (ok) afterColonyAction(G, actor, rng);
      return ok;
    }
  }
}


/**
 * Partner (exporter) proposes a counter-request Y on the importer's bilateral route (0.8.3).
 * Does not apply until importer consents (or autoAct accepts).
 */
export function requestCounterTrade(
  G: GameState, exporter: Colony, importerLineId: string, counterNode: NodeType
): boolean {
  // Find importer line that imports from exporter
  for (const imp of G.colonies) {
    const line = findLine(imp, importerLineId);
    if (!line?.route || line.route.sourceKind !== "colony") continue;
    if (line.route.sourceId !== exporter.id) continue;
    if (!colonyTradeOk(G, exporter, imp)) {
      pushLog(G, `Counter blocked — affinity/trade gate (${exporter.name} ⇄ ${imp.name}).`);
      return false;
    }
    if (extras(imp, counterNode) < 1 && imp.specialty !== counterNode) {
      // Importer must be able to supply counter (extras/specialty)
      if (extras(imp, counterNode) < 1) {
        pushLog(G, `${imp.name} cannot supply counter ${counterNode}.`);
        return false;
      }
    }
    line.route.counterNode = counterNode;
    line.route.counterConsent = false;
    pushLog(G, `${exporter.name} counter-requests ${counterNode} on trade with ${imp.name} (${line.route.node} ⇄ ${counterNode}?).`, true);
    return true;
  }
  return false;
}

/** Importer consents to counter Y — bilateral X ⇄ Y on same route. */
export function consentCounterTrade(
  G: GameState, importer: Colony, lineId: string, accept: boolean
): boolean {
  const line = findLine(importer, lineId);
  if (!line?.route || line.route.sourceKind !== "colony") return false;
  if (!line.route.counterNode) return false;
  if (!accept) {
    pushLog(G, `${importer.name} refuses counter ${line.route.counterNode} to ${line.route.sourceName}.`, true);
    line.route.counterNode = null;
    line.route.counterConsent = false;
    // clear inbound on exporter
    clearInboundCounter(G, importer.id, line.id);
    return true;
  }
  if (!colonyTradeOk(G, importer, G.colonies.find((c) => c.id === line.route!.sourceId)!)) {
    pushLog(G, `Counter consent blocked by trade gate.`);
    return false;
  }
  const y = line.route.counterNode;
  if (extras(importer, y) < 1) {
    pushLog(G, `${importer.name} lacks ${y} for counter.`);
    return false;
  }
  line.route.counterConsent = true;
  // Mirror inbound on exporter's exportRoute
  const donor = G.colonies.find((c) => c.id === line.route!.sourceId);
  if (donor) {
    for (const sl of donor.logisticsLines) {
      if (sl.exportRoute?.colonyId === importer.id && sl.exportRoute.importerLineId === line.id) {
        sl.exportRoute.inboundNode = y;
      }
    }
  }
  // Optionally occupy importer export slot as counter leg for UI
  if (!line.exportRoute && !line.trojanSend) {
    line.exportRoute = {
      colonyId: line.route.sourceId,
      colonyName: line.route.sourceName,
      node: y,
      importerLineId: line.id,
    };
  }
  pushLog(G, `${importer.name} consents: ${line.route.node} ⇄ ${y} with ${line.route.sourceName}.`, true);
  return true;
}

function clearInboundCounter(G: GameState, importerId: string, importerLineId: string): void {
  for (const c of G.colonies) {
    for (const line of c.logisticsLines) {
      if (
        line.exportRoute?.colonyId === importerId &&
        line.exportRoute.importerLineId === importerLineId
      ) {
        line.exportRoute.inboundNode = null;
      }
    }
  }
}

/** AutoAct: exporter may request counter; importer may accept if Needs/fair. */
export function maybeAutoCounter(G: GameState, actor: Colony, rng: Rng): boolean {
  // As importer with pending counter request — accept if we have extras and partner Needs it or we have surplus specialty
  for (const line of actor.logisticsLines) {
    const r = line.route;
    if (!r || r.sourceKind !== "colony" || !r.counterNode || r.counterConsent) continue;
    if (extras(actor, r.counterNode) < 1) continue;
    if (!colonyTradeOk(G, actor, G.colonies.find((c) => c.id === r.sourceId)!)) continue;
    // Accept if not stripping our only vital / or we have surplus
    if (extras(actor, r.counterNode) >= 1) {
      consentCounterTrade(G, actor, line.id, true);
      return true;
    }
  }
  // As exporter: propose counter for a Need if importer has surplus
  for (const line of actor.logisticsLines) {
    const er = line.exportRoute;
    if (!er || line.trojanSend) continue;
    const imp = G.colonies.find((c) => c.id === er.colonyId);
    if (!imp) continue;
    const iLine = findLine(imp, er.importerLineId);
    if (!iLine?.route || iLine.route.counterNode) continue;
    if (!colonyTradeOk(G, actor, imp)) continue;
    // Pick a Need of actor that importer can spare
    const needs: NodeType[] = [];
    if (extras(actor, actor.requires) <= 0) needs.push(actor.requires);
    for (const n of BASAL_NODES) {
      if (extras(actor, n) <= 0) needs.push(n);
    }
    for (const n of needs) {
      if (extras(imp, n) >= 1 && n !== iLine.route.node) {
        if (requestCounterTrade(G, actor, iLine.id, n)) {
          // Auto-consent if fair/Needs
          if (isVitalNeed(actor, n) || extras(imp, n) >= 2) {
            consentCounterTrade(G, imp, iLine.id, true);
          }
          return true;
        }
      }
    }
  }
  return false;
}

/** Mark colony acted + fervor ledger + survival clocks (0.9.0). */
export function afterColonyAction(G: GameState, c: Colony, rng: Rng): void {
  if (!c.acted) c.acted = true;
  tickFervor(G, c, rng);
  tickSurvivalClocks(G, c, rng);
}

/** Grant clean colony→colony import without setting acted (Trojan victim side). */
export function grantColonyImport(
  G: GameState, recipient: Colony, lineId: string, donor: Colony, node: NodeType, rng: Rng,
  donorExportLineId?: string
): boolean {
  if (node === "Logistics") return false;
  const line = findLine(recipient, lineId);
  if (!line || line.route !== null || line.lentTo || line.trojanSend) return false;
  if (extras(donor, node) < 1) return false;
  if (!colonyTradeOk(G, donor, recipient)) return false;
  const source: TradeSource = { kind: "colony", colony: donor, node };
  if (!lineCanServeTrade(line, recipient, source)) return false;
  if (donorExportLineId) {
    const eline = findLine(donor, donorExportLineId);
    if (!eline || eline.exportRoute != null || eline.lentTo || eline.trojanExport || eline.trojanSend || eline.kind === "borrowed") {
      return false;
    }
    if (!lineCanServeExport(eline, donor, recipient)) return false;
    eline.exportRoute = {
      colonyId: recipient.id, colonyName: recipient.name, node, importerLineId: line.id,
    };
  } else if (!claimColonyExport(G, recipient, donor, node, line.id)) {
    return false;
  }
  const vital = isVitalNeed(recipient, node);
  line.route = makeRoute(source);
  if (vital) line.route.vital = true;
  applyRouteStartEffects(G, recipient, source, rng);
  if (node === recipient.requires) develop(G, recipient, rng);
  if (vital) {
    for (const sl of donor.logisticsLines) {
      if (sl.exportRoute?.colonyId === recipient.id && sl.exportRoute.importerLineId === line.id) {
        sl.exportRoute.vital = true;
      }
    }
  }
  pushLog(G, `${recipient.name} starts import of ${node} from ${donor.name} on ${line.name}.`, true);
  return true;
}

export function passActing(G: GameState): boolean {
  const actor = getActingColony(G);
  if (!actor) return false;
  pushLog(G, `${actor.name} passes.`);
  // Need rng for fervor — use a deterministic pass without revolution rng from seed offset
  // Session should call passActingWithRng; keep compatibility via mulberry32(turn+id)
  const rng = mulberry32((G.seed ^ (G.turn * 2654435761) ^ actor.id.length) >>> 0 || 1);
  afterColonyAction(G, actor, rng);
  return true;
}

export function passActingWithRng(G: GameState, rng: Rng): boolean {
  const actor = getActingColony(G);
  if (!actor) return false;
  pushLog(G, `${actor.name} passes.`);
  afterColonyAction(G, actor, rng);
  return true;
}

export function canFound(G: GameState): boolean {
  if (!foundingCooldownReady(G)) return false;
  return G.blocs.some((b) => canBlocFound(b));
}

export function tradeSourceKey(s: TradeSource): string {
  return s.kind === "earth"
    ? `earth|${s.bloc.name}|${s.node}|${s.slotIndex}`
    : `colony|${s.colony.id}|${s.node}`;
}

export function moveKey(m: PlayerMove): string {
  switch (m.kind) {
    case "start": return `start|${m.lineId}|${tradeSourceKey(m.source)}`;
    case "start-lend": return `start-lend|${m.lenderId}|${m.lenderLineId}|${tradeSourceKey(m.source)}`;
    case "switch": return `switch|${m.lineId}|${tradeSourceKey(m.source)}`;
    case "cancel-route": return `cancel-route|${m.lineId}`;
    case "cancel-logistics-import": return `cancel-logi|${m.lineId}`;
    case "import-logistics": return `import-logi|${tradeSourceKey(m.source)}`;
    case "found-colony": return `found-colony`;
    case "trojan": return `trojan|${m.victimId}|${m.node}|${m.attackerLineId}|${m.victimLineId}`;
    case "cancel-trojan-send": return `cancel-trojan|${m.lineId}`;
    case "counter-request": return `counter-req|${m.lineId}|${m.counterNode}`;
    case "counter-consent": return `counter-consent|${m.lineId}|${m.accept ? "1" : "0"}`;
    case "invade": return `invade|${m.defenderId}`;
  }
}

export function tradeSourceLabel(s: TradeSource): string {
  return s.kind === "earth" ? `${s.bloc.name} → ${s.node}` : `${s.colony.name} → ${s.node}`;
}

export function moveLabel(G: GameState, actor: Colony, m: PlayerMove): string {
  switch (m.kind) {
    case "start": {
      const line = findLine(actor, m.lineId);
      const via = line?.kind === "borrowed" ? ` (${line.name})` : "";
      return `Start: ${tradeSourceLabel(m.source)} on ${line?.name ?? m.lineId}${via}`;
    }
    case "start-lend": {
      const lender = G.colonies.find((c) => c.id === m.lenderId);
      const ally = lender?.name ?? m.lenderId;
      return `Start: ${tradeSourceLabel(m.source)} via [${ally}] Logistics`;
    }
    case "switch": {
      const line = findLine(actor, m.lineId);
      return `Switch ${line?.name ?? m.lineId} → ${tradeSourceLabel(m.source)}`;
    }
    case "cancel-route": {
      const line = findLine(actor, m.lineId);
      const r = line?.route;
      return r ? `Cancel: ${r.node} from ${r.sourceName}` : `Cancel route on ${m.lineId}`;
    }
    case "cancel-logistics-import": {
      const line = findLine(actor, m.lineId);
      return `Cancel ${line?.name ?? "imported logistics"}`;
    }
    case "import-logistics":
      return `Import Logistics from ${sourceLabel(m.source)} (+1 line)`;
    case "found-colony":
      return `Found Independent colony (spend 1 free logistics line)`;
    case "trojan": {
      const v = G.colonies.find((c) => c.id === m.victimId);
      return `Send Subversion (Trojan) to ${v?.name ?? m.victimId} via reverse logistics`;
    }
    case "cancel-trojan-send": {
      const line = findLine(actor, m.lineId);
      return `Cancel Trojan send on ${line?.name ?? m.lineId}`;
    }
    case "counter-request":
      return `Counter-request ${m.counterNode} on route ${m.lineId}`;
    case "counter-consent":
      return m.accept ? `Consent counter on ${m.lineId}` : `Refuse counter on ${m.lineId}`;
    case "invade": {
      const def = G.colonies.find((c) => c.id === m.defenderId);
      return `Invade ${def?.name ?? m.defenderId} (spend Military token)`;
    }
  }
}

export function parseTradeSourceKey(G: GameState, key: string): TradeSource | null {
  const parts = key.split("|");
  if (parts.length < 3) return null;
  if (parts[0] === "earth") {
    if (parts.length < 4) return null;
    const node = parts[2] as NodeType;
    if (!NODES.includes(node)) return null;
    const bloc = blocByName(G, parts[1]!);
    if (!bloc) return null;
    const slotIndex = Number(parts[3]);
    if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < bloc.excess.length) {
      const slot = bloc.excess[slotIndex]!;
      if (slot.node === node && slot.claimedBy === null) return { kind: "earth", bloc, node, slotIndex };
    }
    const idx = findUnclaimedSlot(bloc, node);
    if (idx < 0) return null;
    return { kind: "earth", bloc, node, slotIndex: idx };
  }
  if (parts[0] === "colony") {
    const node = parts[2] as NodeType;
    if (!NODES.includes(node)) return null;
    const colony = G.colonies.find((c) => c.id === parts[1]);
    if (!colony || extras(colony, node) < 1) return null;
    return { kind: "colony", colony, node };
  }
  return null;
}

export function parseMoveKey(G: GameState, key: string): PlayerMove | null {
  const parts = key.split("|");
  if (!parts.length) return null;
  const kind = parts[0]!;
  if (kind === "start" || kind === "switch") {
    if (parts.length < 3) return null;
    const source = parseTradeSourceKey(G, parts.slice(2).join("|"));
    if (!source) return null;
    return { kind, lineId: parts[1]!, source };
  }
  if (kind === "start-lend") {
    if (parts.length < 4) return null;
    const lenderId = parts[1]!;
    const lenderLineId = parts[2]!;
    const source = parseTradeSourceKey(G, parts.slice(3).join("|"));
    if (!source) return null;
    return { kind: "start-lend", lenderId, lenderLineId, source };
  }
  if (kind === "cancel-route") return parts[1] ? { kind: "cancel-route", lineId: parts[1] } : null;
  if (kind === "cancel-logi") return parts[1] ? { kind: "cancel-logistics-import", lineId: parts[1] } : null;
  if (kind === "import-logi") {
    const source = parseTradeSourceKey(G, parts.slice(1).join("|"));
    if (!source || source.node !== "Logistics") return null;
    return { kind: "import-logistics", source };
  }
  if (kind === "found-colony") return { kind: "found-colony" };
  if (kind === "trojan") {
    if (parts.length < 5) return null;
    const victimId = parts[1]!;
    const node = parts[2] as NodeType;
    if (!NODES.includes(node)) return null;
    return {
      kind: "trojan",
      victimId,
      node,
      attackerLineId: parts[3]!,
      victimLineId: parts[4]!,
    };
  }
  if (kind === "cancel-trojan") return parts[1] ? { kind: "cancel-trojan-send", lineId: parts[1] } : null;
  if (kind === "counter-req") {
    if (parts.length < 3) return null;
    const counterNode = parts[2] as NodeType;
    if (!NODES.includes(counterNode)) return null;
    return { kind: "counter-request", lineId: parts[1]!, counterNode };
  }
  if (kind === "counter-consent") {
    if (parts.length < 3) return null;
    return { kind: "counter-consent", lineId: parts[1]!, accept: parts[2] === "1" };
  }
  if (kind === "invade") {
    if (!parts[1]) return null;
    return { kind: "invade", defenderId: parts[1] };
  }
  return null;
}

export function formatLeaderboard(G: GameState): string {
  const lines: string[] = ["=== Colonies (by RP) ==="];
  for (const c of sortedColonies(G)) {
    const nodes = NODES.filter((n) => extras(c, n) > 0)
      .map((n) => `${n}:${extras(c, n)}${c.specialty === n ? "*" : ""}`).join(", ");
    const logiStr = c.logisticsLines
      .map((l) => l.route ? `${l.name}→${l.route.node}@${l.route.sourceName}` : `${l.name}[free]`)
      .join("; ");
    lines.push(
      `  ${c.name}  L${colonyLevel(c)}  RP ${rp(c, G.bodyTF)}  strain ${strainOf(c)}  ${c.body}  patron=${c.patron}` +
      (isIndependent(c) ? ` liege=${c.liegeId}` : ` fervor=${c.fervor}`) +
      `  needs ${c.requires}  ` +
      `lines ${freeLineCount(c)}/${logiCap(c)} occupied ${occupiedLineCount(c)}  extras [${nodes}]`
    );
    lines.push(`    logistics: ${logiStr}`);
  }
  lines.push("=== Earth blocs ===");
  for (const b of G.blocs) {
    const excessStr = b.excess.map((s) => (s.claimedBy ? `${s.node}@${s.claimedBy}` : s.node)).join(",");
    const ready = canBlocFound(b) ? " active-colonial" : "";
    const techStr = isUncappedFounder(b.name) ? `${b.tech} (internal)` : `${b.tech}/${b.cap}`;
    lines.push(
      `  ${b.name} [${b.alliance}] tech ${techStr}${ready} excess ${earthClaimedCount(b)}/${b.excess.length} [${excessStr}] colonies=${b.colonies}`
    );
  }
  lines.push(`=== Body TF: Moon ${G.bodyTF.Moon}, Mars ${G.bodyTF.Mars} ===`);
  return lines.join("\n");
}

export function formatLog(G: GameState): string {
  return G.log.map((e) => `T${e.turn}: ${e.msg}`).join("\n");
}



/** Max length for player-editable colony / culture / ideology labels (0.7.2). */
export const MAX_LABEL_LEN = 48;

export function sanitizeLabel(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length > MAX_LABEL_LEN) return t.slice(0, MAX_LABEL_LEN).trim();
  return t;
}

/** Ensure colony display name is unique; append ` 2`, ` 3`, … on clash. */
export function uniqueColonyName(G: GameState, desired: string, exceptId?: string): string {
  const base = desired;
  let candidate = base;
  let n = 1;
  while (G.colonies.some((c) => c.id !== exceptId && c.name === candidate)) {
    n += 1;
    candidate = `${base} ${n}`;
  }
  return candidate;
}

export function renameColony(G: GameState, id: string, rawName: string): boolean {
  const c = G.colonies.find((x) => x.id === id);
  if (!c) return false;
  const label = sanitizeLabel(rawName);
  if (!label) return false;
  const next = uniqueColonyName(G, label, id);
  if (next === c.name) return true;
  const prev = c.name;
  c.name = next;
  // Keep export route display names in sync
  for (const other of G.colonies) {
    for (const l of other.logisticsLines) {
      if (l.exportRoute?.colonyId === id) l.exportRoute.colonyName = next;
      if (l.route?.sourceKind === "colony" && l.route.sourceId === id) l.route.sourceName = next;
    }
  }
  pushLog(G, `${prev} renamed to ${next}.`);
  return true;
}

export function renameCulture(G: GameState, colonyId: string, index: number, rawLabel: string): boolean {
  const c = G.colonies.find((x) => x.id === colonyId);
  if (!c) return false;
  if (index < 0 || index >= c.culture.length) return false;
  const label = sanitizeLabel(rawLabel);
  if (!label) return false;
  const prev = c.culture[index]!;
  if (prev === label) return true;
  c.culture[index] = label;
  pushLog(G, `${c.name} culture[${index}] ${prev} → ${label}.`);
  return true;
}

export function renameIdeology(G: GameState, colonyId: string, index: number, rawLabel: string): boolean {
  const c = G.colonies.find((x) => x.id === colonyId);
  if (!c) return false;
  if (index < 0 || index >= c.ideology.length) return false;
  const label = sanitizeLabel(rawLabel);
  if (!label) return false;
  const prev = c.ideology[index]!;
  if (prev === label) return true;
  c.ideology[index] = label;
  pushLog(G, `${c.name} ideology[${index}] ${prev} → ${label}.`);
  return true;
}

export function renameIdeologyImported(G: GameState, colonyId: string, index: number, rawLabel: string): boolean {
  const c = G.colonies.find((x) => x.id === colonyId);
  if (!c) return false;
  if (index < 0 || index >= c.ideologyImported.length) return false;
  const label = sanitizeLabel(rawLabel);
  if (!label) return false;
  const prev = c.ideologyImported[index]!;
  if (prev === label) return true;
  c.ideologyImported[index] = label;
  pushLog(G, `${c.name} imported ideology[${index}] ${prev} → ${label}.`);
  return true;
}

// Bind L3 helpers (avoids circular imports at module init)
bindL3({
  pushLog,
  CULTURES,
  IDEOLOGIES,
  blocByName,
  releaseEarthClaim,
  makeColony,
  rollSpecialtyRequires,
  findSources: findSourcesRaw,
  socialAffinity: (G, a, b) => socialAffinity(G, a, b),
  findLine,
  returnLentLine,
  clearRouteOnLine,
  grantColonyImport,
  isFriendlyEarthBloc: (G, actor, bloc) =>
    isFriendlyEarthBloc(G, actor, bloc, CULTURES, IDEOLOGIES),
  foundingCooldownReady,
  pickFoundingBody: (G, patron, liegeId) => foundingBodyFor(G, patron, socialAffinity, liegeId),
});

bindV080({
  pushLog,
  grantColonyImport,
  clearRouteOnLine,
  releaseEarthClaim,
  blocByName,
  socialAffinity: (G, a, b) => socialAffinity(G, a, b),
  CULTURES,
});

bindL4({
  pushLog,
  makeColony,
  IDEOLOGIES,
  blocByName,
  socialAffinity: (G, a, b) => socialAffinity(G, a, b),
  clearRouteOnLine,
  findLine,
  foundingCooldownReady,
  nomadRefugees: (G, origin, reason, rng) => crises.nomadRefugees(G, origin, reason, rng),
  onOxygenDeaths: (G, c) => crises.markHoarders(G, c),
});

export {
  extras, strainOf, rp, rpNodeScore, logisticsRpContribution, colonyLevel, logiAvail, logiCap, NODES, DEPS, mulberry32,
  missingDepsOf, strainedNodes, freeExcessNodes, freeLines, occupiedLines,
  occupiedLineCount, freeLineCount, activeImportCount, cleanCount, bodyAdj,
  stackedDepNeeds, depCoverRequired,
  // L3
  tickFervor, tryIndependentFound, canIndependentFound, listTrojanTargets, executeTrojan,
  executeTrojanSend, cancelTrojanSend, computeFervorLedger, canSendTrojan,
  onSubversionRouteStart, onSubversionDevelop, shouldAcceptEnemySubversion, sameBloc, isIndependent,
  INDEPENDENT_PATRON, FERVOR_THRESHOLD, MISSING_BASAL_FERVOR_CAP, BASAL_NODES,
  applyFervorParams, fervorParamsOf, DEFAULT_FERVOR_PARAMS, LEGACY_FERVOR_PARAMS,
  colonyAgeTurns, hasAllianceTradeLockout, hasSurvivalFailurePressure,
  wouldSeverOnRevolution, wouldSeverEarthBloc, independenceScore, missingBasals,
  importsFromPatronNetwork, trojanAcceptanceGate, hasFriendlySource, nodeFixesHardIssue,
  freeOwnNonBaseLines, cultureMisalignedWithPatron, ideologyMisalignedWithPatron,
  severableLinkCount, exitSafetyHigh, executeRevolution, maybeRevolution, canAttemptRevolution,
  // 0.7.1
  lineCanServeTrade, earthTradeAllowed, evaluateAllianceShifts, isVitalNeed,
  pickExportLine, clearExportToImporter, reachForBody, MAX_OPPOSITE_EARTH_ROUTES,
  countOppositeAllianceEarthRoutes, actorEarthAlliance, isFriendlyEarthBloc,
  hasFriendlyAlternative, earthBlocSocialAffinity,
  // 0.8.0 / 0.8.2
  FOUNDING_COOLDOWN_TURNS, MOON_SOFT_CAP, SOLAR_BLOC_COOLDOWN_TURNS,
  MARS_MOON_MIN_COLONIES, MARS_MOON_RP_SUM,
  foundingBody, foundingBodyFor, foundingCooldownReady, hasNationFeedSurplus,
  nationColorForColony, nationColorForEarth, nationRpEarth, sameNation, allNationRp,
  leadingNation, canFoundMars, hasStrongLunarBasis, hasLunarAllyFeed,
  nationMoonColonies, hasLogisticsExportCapacity,
  applySolarBlocParams, solarBlocParamsOf, solarBlocMinTurn,
  DEFAULT_SOLAR_BLOC_PARAMS, LEGACY_SOLAR_BLOC_PARAMS,
  tryFeedNewColony, tryRelationFoundSolarBloc, maybeVitalRouteCuts, tagRouteVital,
  unfairExtractionFervorDelta, onVitalIntraNationCancel, cultureIdeologyAffinity,
  solarBlocNameFromLiege,
  // L4 / 0.9.0
  setIndependenceThreshold, independenceThresholdOf, hasHealth, isBodyLivable,
  hasInvasionToken, burnMilitaryToken, destroyOneDevelopedNode, canInvade, listInvadeTargets,
  invade, tickSurvivalClocks, emitRefugees, maybeAutoInvade, decayThreatTrack, threatLevel,
  ensureClocks, annexColony,
  STATIONED_DEFENSE, TF_LIVABLE, SURVIVAL_CLOCK_TRIP, EARTH_THREAT_KEY,
  DEFAULT_INDEPENDENCE_THRESHOLD, INVADE_DESTROY_PRIORITY,
};
export type {
  GameState, GameMode, Colony, EarthBloc, ExcessSlot, FoundingAnnouncement,
  ImportRoute, ExportRoute, LogisticsLine, LineReach, NodeType, Body, Alliance, LogEntry,
  IndependentGroupSnap, FervorParams, SolarBlocParams,
};
