import { applyRules, ruleNum, ruleOn, type Rules } from "./rules.js";
import { colonyHistory, type HistoryEra } from "./events.js";
import { clockTripsFor, survivalNeed, survivalCover, freePopulation, coveredPopulationNeed } from "./l4.js";
import type { FlagDesign } from "./flagDesign.js";
import { flagForColony, flagForEarth } from "./flagLineage.js";
import { needsTree, listSuppliers, type TreeNode, type Supplier } from "./needs.js";
import { mulberry32, type Rng } from "./rng.js";
import {
  nationColorForColony, nationColorForEarth, nationRpEarth, leadingNation,
  autoAct,
  canFound,
  canBlocFound,
  foundingTax,
  createGame,
  finishTurn,
  getActingColony,
  isUncappedFounder,
  listMoves,
  parseMoveKey,
  applyMove,
  moveKey,
  moveLabel,
  passActing,
  passActingWithRng,
  runTurn,
  isIndependent,
  canIndependentFound,
  sortedColonies,
  startTurn,
  tryFound,
  extras,
  strainOf,
  rp,
  colonyLevel,
  logiAvail,
  logiCap,
  occupiedLineCount,
  freeLineCount,
  cleanCount,
  NODES,
  missingDepsOf,
  strainedNodes,
  freeExcessNodes,
  importCostsLogistics,
  consentsExport,
  earthClaimedCount,
  socialAffinity,
  renameColony,
  renameCulture,
  renameIdeology,
  renameIdeologyImported,
  setIndependenceThreshold, independenceThresholdOf, threatLevel, hasInvasionToken,
  applyFervorParams,
  applySolarBlocParams,
  type TradeSource,
  type PlayerMove,
  type FervorParams,
  type SolarBlocParams,
} from "./engine.js";
import {
  DEFAULT_VARIANT_ID, variantById, defaultVariant,
} from "./fervorVariants.js";
import {
  DEFAULT_SOLAR_VARIANT_ID, solarVariantById, defaultSolarVariant,
} from "./solarBlocVariants.js";
import { NODE_COLORS } from "./nodes.js";
import type {
  Body, Colony, EarthBloc, ExcessSlot, GameState, LogEntry, LogisticsLine, NodeType,
} from "./types.js";

export interface LineSnap {
  id: string; name: string; kind: string; status: string; free: boolean;
  routeNode: NodeType | null; routeSource: string | null; lentTo: string | null;
  exportNode: NodeType | null; exportTo: string | null; reach: string | null;
  vital?: boolean; threatened?: boolean;
  /** 0.19.0 relay: this Earth line also delivers to … / this line is a relay from … */
  relayTo?: string | null; relayFrom?: string | null;
}
export interface NodeRow {
  node: NodeType; extras: number; clean: number; developed: number; specialty: boolean;
  missingDeps: NodeType[]; covered: boolean; strained: boolean; originHint: string;
}
export interface NodeSummary {
  inUseStrained: NodeType[]; needed: NodeType[]; freeExcess: NodeType[];
  cleanImports: string[]; developed: string[];
}
export type { TreeNode, Supplier };
export interface ColonySnap {
  /** 0.15.0 flag design (lineage/function/ideology). */
  flag: FlagDesign;
  id: string; name: string; patron: string; body: Body; bodyMod: number;
  specialty: NodeType; requires: NodeType; culture: string[]; ideology: string[];
  ideologyImported: string[]; ideologyDevelopCount: number;
  acted: boolean; rp: number; level: number; strain: number; logiAvail: number; logiCap: number;
  occupied: number; isActing: boolean; nodes: NodeRow[]; summary: NodeSummary; lines: LineSnap[];
  fervor: number; liegeId: string | null; independent: boolean; canFoundIndependent: boolean;
  nationColor: string; nationRp: number;
  foodClock: number; waterClock: number; oxygenClock: number;
  /** 0.17.0: turns of grace per clock + cover read-out ("2 Pop, 1 Water"). */
  clockTrips: { food: number; water: number; oxygen: number };
  survival: { scaled: boolean; pop: number; freePop: number; food: [number, number]; water: [number, number]; oxygen: [number, number] };
  /** 0.17.0 hook: Oxygen crisis + colonies with spare Oxygen not sending any. */
  oxygenCrisis: { since: number; shortfall: number; suppliers: { name: string; body: string; surplus: number }[]; actions: string[]; refusedBy: string[] } | null;
  /** 0.19.0 */
  camp: { since: number; origin: string; resource: string; repels: number; rejectedBy: string[]; independentAt: number } | null;
  hoarderUntil: number | null;
  casusBelli: { target: string; until: number }[];
  timedFervor: { amount: number; until: number; why: string }[];
  populationStress: number; hasMilitaryToken: boolean; bodyLivable: boolean;
  projectsDone: string[]; projectActive: string | null; projectProgress: number;
  /** 0.13.1 pin alerts (UI read-only). */
  foundedTurn: number | null; proxyAgitation: number; atWar: boolean;
}
export interface ExcessSnap {
  node: NodeType; claimedBy: string | null; claimedName: string | null; color: string;
}
export interface BlocSnap {
  name: string; alliance: string; tech: number; cap: number; claimed: number;
  excessCount: number; excess: ExcessSnap[]; colonies: number;
  activeColonial: boolean; uncapped: boolean; showTech: boolean;
  foundingTax: number;
  nationColor: string; nationRp: number; leadingNation?: boolean;
}
export interface MoveOption {
  key: string; kind: PlayerMove["kind"]; title: string; node: NodeType | null;
  sourceName: string | null; lineName: string | null; fillsRequires: boolean;
  logisticsFree: boolean; badges: string[]; effect: string;
}
export interface IndependentGroupSnap {
  liegeId: string; liegeName: string; members: string[]; colonyCount: number; totalRp: number;
  nationRp: number; nationColor: string; solarBlocName?: string; leadingNation?: boolean;
}
/** 0.14.1 active trade route (importer side), for drawing on the globes. */
export interface RouteSnap {
  id: string; node: NodeType; toId: string; toName: string; toBody: Body;
  fromKind: "earth" | "colony"; fromId: string; fromName: string; fromBody: "Earth" | Body;
  fromColor: string; fromFlagKey: string; toColor: string; toFlagKey: string;
  /** 0.15.0 vexillological flag designs (render with flagDesignToSvg). */
  fromFlag: FlagDesign; toFlag: FlagDesign;
  /** Consented bilateral counter (partner receives counterNode too). */
  counterNode: NodeType | null;
}
export interface UiSnapshot {
  turn: number; seed: number; phase: string; actingId: string | null; actingName: string | null;
  selectedId: string | null; canFound: boolean; foundingTaxHint: string | null;
  allActed: boolean; bodyTF: Record<Body, number>;
  blocs: BlocSnap[]; independentGroups: IndependentGroupSnap[];
  colonies: ColonySnap[]; selected: ColonySnap | null;
  moveOptions: MoveOption[]; turnAnnouncements: string[]; log: LogEntry[];
  leadingNationLabel: string | null;
  independenceThreshold: number;
  /** Survival clock trip (rule refugeeClockTrip; 3 without rules). */
  clockTrip: number;
  threatLevel: number;
  bodyLivable: Record<string, boolean>;
  routes: RouteSnap[];
  /** 0.21.0 History tab: eras + chronicle of the selected colony (from the event log). */
  selectedHistory: HistoryEra[];
  /** 0.21.0 rule eventLog on (History tab has data). */
  eventLog: boolean;
}

function snapLines(G: GameState, c: Colony): LineSnap[] {
  return c.logisticsLines.map((l) => {
    const parts: string[] = [];
    if (l.lentTo) {
      const borrower = G.colonies.find((x) => x.id === l.lentTo);
      parts.push(`Lent to ${borrower?.name ?? l.lentTo}`);
    } else {
      if (l.trojanSend) {
        parts.push(`Trojan send → ${l.trojanSend.targetName}`);
      } else if (l.route && l.route.sourceKind === "colony" && l.route.counterConsent && l.route.counterNode) {
        const via = l.kind === "borrowed" ? ` (${l.name})` : "";
        parts.push(`Trade: ${l.route.node} ⇄ ${l.route.counterNode} with ${l.route.sourceName}${via}`);
      } else if (l.route && l.route.sourceKind === "colony" && l.route.counterNode && !l.route.counterConsent) {
        parts.push(`Trade: ${l.route.node} ⇄ ${l.route.counterNode}? (pending) ←${l.route.sourceName}`);
      } else {
        if (l.route) {
          const via = l.kind === "borrowed" ? ` (${l.name})` : "";
          parts.push(`In: ${l.route.node}←${l.route.sourceName}${via}`);
        }
        if (l.exportRoute && !(l.route?.sourceKind === "colony" && l.exportRoute.colonyId === l.route.sourceId)) {
          const tag = l.trojanExport || l.exportRoute.trojan ? " (Trojan)" : "";
          parts.push(`Out: ${l.exportRoute.node}→${l.exportRoute.colonyName}${tag}`);
        } else if (l.exportRoute?.inboundNode) {
          parts.push(`Trade return: +${l.exportRoute.inboundNode}`);
        }
      }
      if (!parts.length) {
        parts.push(l.kind === "borrowed" ? l.name : "Free");
      }
    }
    const reach = l.reach ?? (c.body === "Moon" ? "moon" : "mars");
    const vital = !!(l.route?.vital || l.exportRoute?.vital);
    const threatened = !!(l.route?.threatened || l.exportRoute?.threatened);
    if (l.relayTo) parts.push(`relays → ${l.relayTo.colonyName}`);
    if (l.relay) parts.push(`relay from ${l.route?.sourceName ?? "?"}`);
    if (vital && !parts.some((p) => p.includes("vital"))) {
      parts.push(threatened ? "vital⚠" : "vital");
    }
    return {
      id: l.id, name: l.name, kind: l.kind, status: parts.join(" · "),
      free: l.route === null && !l.lentTo && !l.trojanSend && !l.relay,
      relayTo: l.relayTo?.colonyName ?? null, relayFrom: l.relay ? (l.route?.sourceName ?? null) : null,
      routeNode: l.route?.node ?? null,
      routeSource: l.route?.sourceName ?? null,
      lentTo: l.lentTo ?? null,
      exportNode: l.exportRoute?.node ?? null,
      exportTo: l.exportRoute?.colonyName ?? null,
      reach,
      vital,
      threatened,
    };
  });
}

function snapIndependentGroups(G: GameState): IndependentGroupSnap[] {
  const map = new Map<string, IndependentGroupSnap>();
  const lead = leadingNation(G);
  for (const c of G.colonies) {
    if (c.patron !== "Independent" || !c.liegeId) continue;
    let g = map.get(c.liegeId);
    if (!g) {
      const liege = G.colonies.find((x) => x.id === c.liegeId);
      g = {
        liegeId: c.liegeId,
        liegeName: liege?.solarBlocName || liege?.name || c.liegeId,
        members: [],
        colonyCount: 0,
        totalRp: 0,
        nationRp: 0,
        nationColor: nationColorForColony(c),
        solarBlocName: liege?.solarBlocName,
      };
      map.set(c.liegeId, g);
    }
    g.members.push(c.name);
    g.colonyCount += 1;
    g.totalRp += rp(c, G.bodyTF);
    g.nationRp = g.totalRp;
  }
  const out = [...map.values()].sort((a, b) => b.totalRp - a.totalRp || a.liegeName.localeCompare(b.liegeName));
  for (const g of out) {
    g.leadingNation = lead?.kind === "independent" && lead.key === `ind:${g.liegeId}`;
  }
  return out;
}

function nodeRows(c: Colony): NodeRow[] {
  const rows: NodeRow[] = [];
  for (const n of NODES) {
    const ex = extras(c, n);
    if (ex <= 0 && c.specialty !== n) continue;
    const specialty = c.specialty === n;
    const developed = c.developed[n] || 0;
    const clean = cleanCount(c, n);
    const missing = specialty || developed <= 0 ? [] : missingDepsOf(c, n);
    const parts: string[] = [];
    if (specialty) parts.push("specialty");
    if (developed > 0) parts.push(`dev×${developed}`);
    const imp = clean - (specialty ? 1 : 0);
    if (imp > 0) parts.push(`import×${imp}`);
    rows.push({
      node: n, extras: ex, clean, developed, specialty, missingDeps: missing,
      covered: missing.length === 0, strained: developed > 0 && missing.length > 0,
      originHint: parts.join("+") || "—",
    });
  }
  return rows;
}

function nodeSummary(c: Colony): NodeSummary {
  const strained = strainedNodes(c);
  const needed = new Set<NodeType>([c.requires]);
  for (const n of strained) for (const d of missingDepsOf(c, n)) needed.add(d);
  const cleanImports: string[] = [];
  for (const l of c.logisticsLines) {
    if (l.route) cleanImports.push(`${l.route.node}←${l.route.sourceName}`);
    if (l.kind === "import") cleanImports.push(`Logistics←${l.sourceLabel ?? "?"}`);
  }
  const developed: string[] = [];
  for (const n of NODES) {
    const d = c.developed[n] || 0;
    if (d > 0) developed.push(`${n}×${d}`);
  }
  return {
    inUseStrained: strained, needed: Array.from(needed), freeExcess: freeExcessNodes(c),
    cleanImports, developed,
  };
}

/** UI-only: colony named in an invasion log line this turn or last. */
function recentInvasionMention(G: GameState, name: string): boolean {
  for (let i = G.log.length - 1; i >= 0; i--) {
    const e = G.log[i]!;
    if (e.turn < G.turn - 1) break;
    if (e.msg.startsWith("⚔") && e.msg.includes(name)) return true;
  }
  return false;
}

function colonyFlagKey(c: Colony): string {
  return `${c.name}|${c.culture.join("/")}|${c.ideology[0] || ""}`;
}
function snapRoutes(G: GameState): RouteSnap[] {
  const out: RouteSnap[] = [];
  for (const c of G.colonies) {
    for (const l of c.logisticsLines) {
      const r = l.route;
      if (!r || r.trojan || l.trojanExport) continue;
      const src = r.sourceKind === "colony" ? G.colonies.find((x) => x.id === r.sourceId) : undefined;
      if (r.sourceKind === "colony" && !src) continue;
      const bloc = r.sourceKind === "earth" ? G.blocs.find((b) => b.name === r.sourceId || b.name === r.sourceName) : undefined;
      out.push({
        id: `${c.id}:${l.id}`, node: r.node, toId: c.id, toName: c.name, toBody: c.body,
        fromKind: r.sourceKind, fromId: r.sourceId, fromName: src?.name ?? bloc?.name ?? r.sourceName,
        fromBody: src ? src.body : "Earth",
        fromColor: src ? nationColorForColony(src) : (bloc?.nationColor || nationColorForEarth(bloc?.name ?? r.sourceName)),
        fromFlagKey: src ? colonyFlagKey(src) : (bloc?.name ?? r.sourceName),
        toColor: nationColorForColony(c), toFlagKey: colonyFlagKey(c),
        fromFlag: src ? flagForColony(G, src) : flagForEarth(bloc?.name ?? r.sourceName), toFlag: flagForColony(G, c),
        counterNode: r.counterConsent && r.counterNode ? r.counterNode : null,
      });
    }
  }
  return out;
}

function snapColony(G: GameState, c: Colony, actingId: string | null): ColonySnap {
  return {
    id: c.id, name: c.name, patron: c.patron, body: c.body, bodyMod: c.bodyMod, flag: flagForColony(G, c),
    specialty: c.specialty, requires: c.requires, culture: c.culture.slice(),
    ideology: c.ideology.slice(), ideologyImported: c.ideologyImported.slice(),
    ideologyDevelopCount: c.ideologyDevelopCount,
    acted: c.acted, rp: rp(c, G.bodyTF), level: colonyLevel(c),
    strain: strainOf(c), logiAvail: logiAvail(c), logiCap: logiCap(c),
    occupied: occupiedLineCount(c), isActing: actingId === c.id,
    nodes: nodeRows(c), summary: nodeSummary(c), lines: snapLines(G, c),
    fervor: c.fervor ?? 0, liegeId: c.liegeId ?? null,
    independent: isIndependent(c), canFoundIndependent: canIndependentFound(c),
    nationColor: nationColorForColony(c),
    nationRp: isIndependent(c) && c.liegeId
      ? (G.colonies.filter((x) => x.patron === "Independent" && x.liegeId === c.liegeId)
          .reduce((s, x) => s + rp(x, G.bodyTF), 0))
      : nationRpEarth(G, c.patron),
    foodClock: c.foodClock || 0,
    waterClock: c.waterClock || 0,
    oxygenClock: c.oxygenClock || 0,
    clockTrips: clockTripsFor(G, c),
    survival: {
      scaled: !!G.rules && ruleOn(G, "survivalScaledCover"),
      pop: coveredPopulationNeed(c), freePop: freePopulation(c),
      food: [survivalNeed(G, c, "Food"), survivalCover(c, "Food")],
      water: [survivalNeed(G, c, "Water"), survivalCover(c, "Water")],
      oxygen: [survivalNeed(G, c, "Oxygen"), survivalCover(c, "Oxygen")],
    },
    oxygenCrisis: c.oxygenCrisis
      ? { since: c.oxygenCrisis.since, shortfall: c.oxygenCrisis.shortfall,
          suppliers: c.oxygenCrisis.suppliers.map((s) => ({ name: s.name, body: s.body, surplus: s.surplus })),
          actions: [...(c.oxygenCrisis.actions ?? [])],
          refusedBy: (c.oxygenCrisis.refusedBy ?? []).map((id) => G.colonies.find((x) => x.id === id)?.name ?? id) }
      : null,
    camp: c.nomad ? {
      since: c.nomad.since, origin: c.nomad.originName, resource: c.nomad.resource, repels: c.nomad.repels,
      rejectedBy: c.nomad.rejectedBy.map((id) => G.colonies.find((x) => x.id === id)?.name ?? id),
      independentAt: c.nomad.since + (G.rules ? ruleNum(G, "nomadCampTurns") : 20),
    } : null,
    hoarderUntil: c.hoarderUntil != null && c.hoarderUntil >= G.turn ? c.hoarderUntil : null,
    casusBelli: (c.casusBelli ?? []).filter((x) => x.until >= G.turn).map((x) => ({ target: x.targetName, until: x.until })),
    timedFervor: (c.fervorEvents ?? []).filter((e) => e.until >= G.turn).map((e) => ({ amount: e.amount, until: e.until, why: e.why })),
    populationStress: c.populationStress || 0,
    hasMilitaryToken: hasInvasionToken(c),
    bodyLivable: (G.bodyTF[c.body] || 0) >= 10,
    projectsDone: c.projectsDone ?? [], projectActive: c.projectActive ?? null, projectProgress: c.projectProgress ?? 0,
    foundedTurn: c.foundedTurn ?? null,
    proxyAgitation: c.proxyAgitation || 0,
    atWar: (c.proxyAgitation || 0) > 0 || recentInvasionMention(G, c.name),
  };
}

function snapBloc(G: GameState, b: EarthBloc): BlocSnap {
  const activeColonial = canBlocFound(b);
  const lead = leadingNation(G);
  const nrp = nationRpEarth(G, b.name);
  return {
    name: b.name, alliance: b.alliance, tech: b.tech, cap: b.cap,
    claimed: earthClaimedCount(b), excessCount: b.excess.length,
    excess: b.excess.map((s: ExcessSlot) => ({
      node: s.node, claimedBy: s.claimedBy,
      claimedName: s.claimedBy
        ? G.colonies.find((c) => c.id === s.claimedBy)?.name ?? s.claimedBy
        : null,
      color: NODE_COLORS[s.node] || "#94a3b8",
    })),
    colonies: b.colonies, activeColonial,
    uncapped: isUncappedFounder(b.name), showTech: !activeColonial,
    foundingTax: foundingTax(b),
    nationColor: b.nationColor || nationColorForEarth(b.name),
    nationRp: nrp,
    leadingNation: lead?.kind === "earth" && lead.key === b.name,
  };
}

function buildMoveOption(G: GameState, actor: Colony, m: PlayerMove): MoveOption {
  const title = moveLabel(G, actor, m);
  const badges: string[] = [];
  let node: NodeType | null = null;
  let sourceName: string | null = null;
  let lineName: string | null = null;
  let fillsRequires = false;
  let logisticsFree = false;
  let effect = "";

  if (m.kind === "start" || m.kind === "start-lend" || m.kind === "switch" || m.kind === "import-logistics") {
    const src = m.source;
    node = src.node;
    fillsRequires = node === actor.requires;
    logisticsFree = !importCostsLogistics(node);
    if (src.kind === "earth") {
      sourceName = src.bloc.name;
      badges.push("Earth", src.bloc.alliance);
    } else {
      sourceName = src.colony.name;
      badges.push("Colony");
      const aff = socialAffinity(G, src.colony, actor);
      badges.push(`Affinity ${aff}`);
      if (src.colony.patron === actor.patron || (src.colony.patron === "Independent" && actor.patron === "Independent" && src.colony.liegeId && src.colony.liegeId === actor.liegeId)) {
        badges.push("Same bloc");
      } else if (aff >= 2) {
        badges.push("Aff≥2");
      }
    }
    if (fillsRequires) badges.push("Requires");
  }

  if (m.kind === "start") {
    badges.unshift("Start");
    lineName = actor.logisticsLines.find((l) => l.id === m.lineId)?.name ?? m.lineId;
    effect = `Assign ${lineName} · clean ${node} while active`;
    if (fillsRequires) effect += " · develop";
  } else if (m.kind === "start-lend") {
    badges.unshift("Start", "Lend");
    const lender = G.colonies.find((c) => c.id === m.lenderId);
    lineName = `via [${lender?.name ?? "Ally"}] Logistics`;
    badges.push(lineName);
    effect = `Borrow ally logistics · clean ${node} while active`;
    if (fillsRequires) effect += " · develop";
  } else if (m.kind === "switch") {
    badges.unshift("Switch");
    lineName = actor.logisticsLines.find((l) => l.id === m.lineId)?.name ?? m.lineId;
    effect = `Reassign ${lineName}`;
    if (fillsRequires) effect += " · develop";
  } else if (m.kind === "import-logistics") {
    badges.unshift("Logistics+");
    logisticsFree = true;
    badges.push("New line");
    effect = `+1 Imported ${sourceName} logistics`;
  } else if (m.kind === "cancel-route") {
    badges.push("Cancel", "Route");
    const line = actor.logisticsLines.find((l) => l.id === m.lineId);
    lineName = line?.name ?? m.lineId;
    node = line?.route?.node ?? null;
    sourceName = line?.route?.sourceName ?? null;
    if (line?.route?.vital) badges.push("vital");
    effect = "End route · lose clean import · Earth reroll";
  } else if (m.kind === "cancel-logistics-import") {
    badges.push("Cancel", "Logistics");
    const line = actor.logisticsLines.find((l) => l.id === m.lineId);
    lineName = line?.name ?? m.lineId;
    sourceName = line?.sourceLabel ?? null;
    node = "Logistics";
    effect = "Remove imported logistics line";
  } else if (m.kind === "found-colony") {
    badges.push("Found", "Independent");
    effect = "Spend 1 free non-base logistics line · seed culture/ideology · liege network";
  } else if (m.kind === "trojan") {
    badges.push("Trojan", "Subversion", "Send");
    const v = G.colonies.find((c) => c.id === m.victimId);
    sourceName = v?.name ?? m.victimId;
    node = "Subversion";
    effect = `Reverse logistics send · permanent subversion mark · no trade node`;
    const aff = v ? socialAffinity(G, actor, v) : 0;
    badges.push(`Affinity ${aff}`);
  } else if (m.kind === "cancel-trojan-send") {
    badges.push("Cancel", "Trojan");
    const line = actor.logisticsLines.find((l) => l.id === m.lineId);
    lineName = line?.name ?? m.lineId;
    effect = "End Trojan send · mark remains on target";
  } else if (m.kind === "counter-request") {
    badges.push("Counter", "Trade");
    node = m.counterNode;
    effect = `Propose ${m.counterNode} as bilateral counter on same route`;
  } else if (m.kind === "counter-consent") {
    badges.push(m.accept ? "Consent" : "Refuse", "Counter");
    effect = m.accept ? "Accept bilateral counter ⇄" : "Refuse counter request";
  } else if (m.kind === "invade") {
    badges.push("Invade", "Military");
    const def = G.colonies.find((c) => c.id === m.defenderId);
    sourceName = def?.name ?? m.defenderId;
    node = "Military";
    effect = "Destroy 1 defender node · RP compare · annex or burn Military token";
  }

  return {
    key: moveKey(m), kind: m.kind, title, node, sourceName, lineName,
    fillsRequires, logisticsFree, badges, effect,
  };
}

export interface GameSessionOptions {
  /** Named fervor variant id from fervorVariants.ts */
  variantId?: string;
  /** Full/partial FervorParams (applied after variant, if both set). */
  fervorParams?: Partial<FervorParams>;
  /** Override independence threshold after params are applied. */
  independenceThreshold?: number;
  /** Named solar-bloc / diplomacy variant id from solarBlocVariants.ts */
  solarVariantId?: string;
  /** Full/partial SolarBlocParams (applied after solar variant, if both set). */
  solarBlocParams?: Partial<SolarBlocParams>;
  /** 0.9.4+ lobby rule flags (rules.ts); omitted = shipped defaults. */
  rules?: Partial<Rules>;
}

export class GameSession {
  state: GameState;
  rng: Rng;
  selectedId: string | null = null;
  /** Variant id applied at create (for UI). */
  fervorVariantId: string = DEFAULT_VARIANT_ID;
  /** Solar-bloc / diplomacy variant id applied at create (for UI). */
  solarVariantId: string = DEFAULT_SOLAR_VARIANT_ID;

  private constructor(state: GameState, rng: Rng) {
    this.state = state; this.rng = rng;
  }

  static create(seed: number, options?: GameSessionOptions): GameSession {
    const s = (seed >>> 0) || 1;
    const rng = mulberry32(s);
    const state = createGame(s, rng);
    const variantId = options?.variantId ?? DEFAULT_VARIANT_ID;
    const variant = variantById(variantId) ?? defaultVariant();
    applyFervorParams(state, variant.params);
    if (options?.fervorParams) applyFervorParams(state, options.fervorParams);
    if (typeof options?.independenceThreshold === "number" && Number.isFinite(options.independenceThreshold)) {
      setIndependenceThreshold(state, options.independenceThreshold);
    }
    const solarId = options?.solarVariantId ?? DEFAULT_SOLAR_VARIANT_ID;
    const solar = solarVariantById(solarId) ?? defaultSolarVariant();
    applySolarBlocParams(state, solar.params);
    if (options?.solarBlocParams) applySolarBlocParams(state, options.solarBlocParams);
    applyRules(state, options?.rules);
    const session = new GameSession(state, rng);
    session.fervorVariantId = variant.id;
    session.solarVariantId = solar.id;
    session.beginTurn();
    session.selectedId = getActingColony(state)?.id ?? state.colonies[0]?.id ?? null;
    return session;
  }

  beginTurn(): void {
    startTurn(this.state, this.rng);
    const act = getActingColony(this.state);
    if (act) this.selectedId = act.id;
  }

  getActing(): Colony | null { return getActingColony(this.state); }

  /** 0.14.0 Needs tree for a colony (read-only). */
  needsTree(id: string): TreeNode[] | null {
    const c = this.state.colonies.find((x) => x.id === id);
    return c ? needsTree(c) : null;
  }

  /** 0.14.0 Supplier cards; move keys only when `id` is the acting colony. */
  suppliers(id: string, node: NodeType | null): Supplier[] {
    const c = this.state.colonies.find((x) => x.id === id);
    if (!c) return [];
    return listSuppliers(this.state, c, node, getActingColony(this.state)?.id === id);
  }

  select(id: string): void {
    if (this.state.colonies.some((c) => c.id === id)) this.selectedId = id;
  }

  applyByKey(key: string): boolean {
    const move = parseMoveKey(this.state, key);
    if (!move) return false;
    const actor = this.getActing();
    if (!actor) return false;
    if (
      (move.kind === "start" || move.kind === "start-lend" || move.kind === "switch" || move.kind === "import-logistics") &&
      move.source.kind === "colony" &&
      !consentsExport(this.state, move.source.colony, actor, move.source.node)
    ) return false;
    const ok = applyMove(this.state, actor, move, this.rng);
    if (ok) {
      const next = this.getActing();
      if (next) this.selectedId = next.id;
    }
    return ok;
  }

  importByKey(key: string): boolean { return this.applyByKey(key); }

  pass(): boolean {
    const ok = passActingWithRng(this.state, this.rng);
    if (ok) {
      const next = this.getActing();
      if (next) this.selectedId = next.id;
    }
    return ok;
  }

  autoActOnce(): boolean {
    const actor = this.getActing();
    if (!actor) return false;
    autoAct(this.state, actor, this.rng);
    const next = this.getActing();
    if (next) this.selectedId = next.id;
    return true;
  }

  endTurn(): void {
    finishTurn(this.state, this.rng, true);
    this.beginTurn();
  }

  tryFound(): boolean { return tryFound(this.state, this.rng); }
  foundingEligible(): boolean { return canFound(this.state); }

  renameColony(id: string, name: string): boolean {
    return renameColony(this.state, id, name);
  }
  renameCulture(colonyId: string, index: number, label: string): boolean {
    return renameCulture(this.state, colonyId, index, label);
  }
  renameIdeology(colonyId: string, index: number, label: string): boolean {
    return renameIdeology(this.state, colonyId, index, label);
  }
  renameIdeologyImported(colonyId: string, index: number, label: string): boolean {
    return renameIdeologyImported(this.state, colonyId, index, label);
  }

  setIndependenceThreshold(value: number): number {
    return setIndependenceThreshold(this.state, value);
  }

  getIndependenceThreshold(): number {
    return independenceThresholdOf(this.state);
  }

  simulateTurns(n: number): void {
    const turns = Math.max(0, Math.floor(n));
    if (turns <= 0) return;
    for (const c of sortedColonies(this.state)) {
      if (!c.acted) autoAct(this.state, c, this.rng);
    }
    finishTurn(this.state, this.rng, false);
    for (let i = 1; i < turns; i++) runTurn(this.state, this.rng);
    this.beginTurn();
    const act = this.getActing();
    if (act) this.selectedId = act.id;
  }

  snapshot(): UiSnapshot {
    const G = this.state;
    const acting = getActingColony(G);
    const actingId = acting?.id ?? null;
    const allActed = G.colonies.length > 0 && G.colonies.every((c) => c.acted);
    const colonies = sortedColonies(G).map((c) => snapColony(G, c, actingId));
    const selected =
      colonies.find((c) => c.id === this.selectedId) ??
      colonies.find((c) => c.id === actingId) ??
      colonies[0] ?? null;
    const moveOptions: MoveOption[] = [];
    if (acting) {
      for (const m of listMoves(G, acting).slice(0, 48)) {
        moveOptions.push(buildMoveOption(G, acting, m));
      }
    }
    const eligible = G.blocs.filter((b) => canBlocFound(b))
      .sort((a, b) => b.tech - a.tech || a.name.localeCompare(b.name));
    const nextFounder = eligible[0];
    const foundingTaxHint = nextFounder
      ? `${nextFounder.name} would pay founding tax ${foundingTax(nextFounder)} tech (colonies=${nextFounder.colonies})`
      : null;
    const lead = leadingNation(G);
    return {
      turn: G.turn, seed: G.seed, phase: allActed ? "Ready to end" : "Colony",
      actingId, actingName: acting?.name ?? null, selectedId: selected?.id ?? null,
      canFound: canFound(G), foundingTaxHint, allActed, bodyTF: { ...G.bodyTF },
      blocs: G.blocs.map((b) => snapBloc(G, b)),
      independentGroups: snapIndependentGroups(G),
      colonies, selected, moveOptions,
      turnAnnouncements: G.turnAnnouncements.slice(), log: [...G.log].reverse(),
      leadingNationLabel: lead ? `${lead.label} (Nation RP ${lead.nationRp})` : null,
      independenceThreshold: independenceThresholdOf(G),
      clockTrip: G.rules ? ruleNum(G, "refugeeClockTrip") : 3,
      threatLevel: threatLevel(G),
      routes: snapRoutes(G),
      bodyLivable: {
        Moon: (G.bodyTF.Moon || 0) >= 10,
        Mars: (G.bodyTF.Mars || 0) >= 10,
      },
      selectedHistory: selected ? colonyHistory(G, selected.id) : [],
      eventLog: !!G.rules && ruleOn(G, "eventLog"),
    };
  }
}

export function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}

export type { TradeSource, PlayerMove, FervorParams };
export {
  DEFAULT_VARIANT_ID,
  FERVOR_VARIANTS,
  variantById,
  defaultVariant,
  variantKnobLine,
} from "./fervorVariants.js";
export { RULE_DEFS, defaultRules, legacyRules } from "./rules.js";
export type { RuleDef, Rules } from "./rules.js";
export type { FervorVariant } from "./fervorVariants.js";
export {
  DEFAULT_SOLAR_VARIANT_ID,
  SOLAR_BLOC_VARIANTS,
  solarVariantById,
  defaultSolarVariant,
  solarVariantKnobLine,
} from "./solarBlocVariants.js";
export type { SolarBlocVariant } from "./solarBlocVariants.js";
