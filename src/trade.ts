/**
 * 0.7.1 — East/West Earth trade gates, logistics reach, two-way line helpers.
 */
import type { Alliance, Body, Colony, EarthBloc, GameState, LogisticsLine, NodeType } from "./types.js";
import { extras, missingDepsOf, strainedNodes } from "./nodes.js";
import { BASAL_NODES, isIndependent, sameBloc } from "./l3.js";
import { solarBlocParamsOf } from "./nation.js";

export type TradeSourceLike =
  | { kind: "earth"; bloc: EarthBloc; node: NodeType; slotIndex: number }
  | { kind: "colony"; colony: Colony; node: NodeType };

/** Max simultaneous opposite-alliance Earth import routes (fair rule). */
export const MAX_OPPOSITE_EARTH_ROUTES = 1;

export const WEST_IDEOLOGIES = new Set([
  "Democratic Free Market",
  "Corporate Pioneerism",
  "Technocratic Pioneerism",
  "Social Market",
  "Liberal Constitutionalism",
]);
export const EAST_IDEOLOGIES = new Set([
  "Chinese Socialism",
  "Platform Socialism",
  "Corporate Socialism",
  "Putinism",
]);
export const WEST_CULTURES = new Set(["American", "Corporate American", "European", "Commonwealth"]);
export const EAST_CULTURES = new Set(["Chinese", "Corporate Chinese", "Russian"]);

export function reachForBody(body: Body): "earth" | "moon" | "mars" | "belt" {
  return body === "Moon" ? "moon" : body === "Belt" ? "belt" : "mars";
}

export function reachForLogisticsImport(source: TradeSourceLike): "earth" | "moon" | "mars" | "belt" {
  if (source.kind === "earth") return "earth";
  return reachForBody(source.colony.body);
}

/**
 * Reach matrix:
 * - earth: Earth↔Moon only (also Earth→Mars when the line sits on Mars)
 * - moon:  Earth↔Moon and Moon↔Mars (+ Moon-local)
 * - mars:  Moon↔Mars and Mars-local — never Earth↔Moon
 */
export function reachSupports(
  reach: "earth" | "moon" | "mars" | "belt",
  from: "Earth" | Body,
  to: Body,
  /** 0.20.0 Thrust reach of the line (owner/lender Thrust ≥ threshold, or a depot). */
  beltOk = false,
): boolean {
  // 0.20.0 asteroid belt: only Mars ↔ Belt, on a Mars/Belt line with Thrust reach (never Earth/Moon, never Belt↔Belt)
  if (from === "Belt" || to === "Belt") {
    const other = from === "Belt" ? to : from;
    return other === "Mars" && (reach === "mars" || reach === "belt") && beltOk;
  }
  if (reach === "belt") reach = "mars"; // a belt line lent inward behaves like a Mars line
  if (from === "Earth") {
    if (to === "Moon") return reach === "earth" || reach === "moon";
    // Mars may only import Earth on an Earth-sourced line
    if (to === "Mars") return reach === "earth";
    return false;
  }
  if (from === to) {
    if (from === "Moon") return reach === "moon" || reach === "earth";
    if (from === "Mars") return reach === "mars" || reach === "moon";
    return false;
  }
  // Moon ↔ Mars
  const moonMars =
    (from === "Moon" && to === "Mars") || (from === "Mars" && to === "Moon");
  if (moonMars) return reach === "moon" || reach === "mars";
  return false;
}

export function tradeEndpoints(
  actor: Colony,
  source: TradeSourceLike
): { from: "Earth" | Body; to: Body } {
  if (source.kind === "earth") return { from: "Earth", to: actor.body };
  return { from: source.colony.body, to: actor.body };
}

/** Can this importer line carry the trade (reach + not lent)? */
export function lineCanServeTrade(
  line: LogisticsLine,
  actor: Colony,
  source: TradeSourceLike
): boolean {
  if (line.lentTo) return false;
  const reach = line.reach ?? reachForBody(actor.body);
  const { from, to } = tradeEndpoints(actor, source);
  return reachSupports(reach, from, to, !!line.beltOk);
}

/** Exporter line must cover the same body pair from the exporter's perspective. */
export function lineCanServeExport(
  line: LogisticsLine,
  exporter: Colony,
  importer: Colony
): boolean {
  if (line.lentTo) return false;
  if (line.kind === "borrowed") return false;
  const reach = line.reach ?? reachForBody(exporter.body);
  return reachSupports(reach, exporter.body, importer.body, true); // 0.20.0: the importer's line carries the Thrust reach
}

export function isVitalNeed(actor: Colony, node: NodeType): boolean {
  if (node === actor.requires) return true;
  if ((BASAL_NODES as readonly string[]).includes(node) && extras(actor, node) <= 0) return true;
  for (const n of strainedNodes(actor)) {
    if (missingDepsOf(actor, n).includes(node)) return true;
  }
  return false;
}

export function actorEarthAlliance(G: GameState, actor: Colony): Alliance | null {
  if (isIndependent(actor)) return null;
  return G.blocs.find((b) => b.name === actor.patron)?.alliance ?? null;
}

/** Culture/ideology affinity of an Independent (or any colony) to an Earth bloc's tags. */
export function earthBlocSocialAffinity(
  actor: Colony,
  bloc: EarthBloc,
  cultures: Record<string, string>,
  ideologies: Record<string, string>
): number {
  let score = 0;
  const cult = cultures[bloc.name];
  if (cult && actor.culture.includes(cult)) score += 1;
  const ideo = ideologies[bloc.name];
  const all = new Set([...actor.ideology, ...actor.ideologyImported]);
  if (ideo && all.has(ideo)) score += 1;
  return score;
}

export function countOppositeAllianceEarthRoutes(G: GameState, actor: Colony): number {
  const aAll = actorEarthAlliance(G, actor);
  let n = 0;
  for (const line of actor.logisticsLines) {
    const r = line.route;
    if (!r || r.sourceKind !== "earth") continue;
    const bloc = G.blocs.find((b) => b.name === r.sourceId);
    if (!bloc) continue;
    if (bloc.alliance === "Neutral") continue;
    if (aAll === null) {
      // Independent: East/West both "opposite" unless affinity — count East/West routes as opposite-gated
      if (bloc.alliance === "West" || bloc.alliance === "East") n += 1;
    } else if (aAll !== "Neutral" && bloc.alliance !== aAll) {
      n += 1;
    }
  }
  // Imported Logistics from opposite also counts as a route/claim
  for (const line of actor.logisticsLines) {
    if (line.kind !== "import" || !line.earthClaim) continue;
    const bloc = G.blocs.find((b) => b.name === line.earthClaim!.blocName);
    if (!bloc || bloc.alliance === "Neutral") continue;
    if (aAll === null) {
      if (bloc.alliance === "West" || bloc.alliance === "East") n += 1;
    } else if (aAll !== "Neutral" && bloc.alliance !== aAll) {
      n += 1;
    }
  }
  return n;
}

/**
 * Friendly alternative exists for `node` (same-alliance Earth, Neutral Earth,
 * Independent affinity Earth, same-patron / affinity≥1 colony) — excluding the
 * opposite bloc being considered.
 */
export function hasFriendlyAlternative(
  G: GameState,
  actor: Colony,
  node: NodeType,
  cultures: Record<string, string>,
  ideologies: Record<string, string>,
  socialAffinity: (G: GameState, a: Colony, b: Colony) => number,
  consentsExport: (G: GameState, donor: Colony, recipient: Colony, node: NodeType) => boolean,
  excludingBlocName?: string
): boolean {
  const aAll = actorEarthAlliance(G, actor);
  for (const b of G.blocs) {
    if (excludingBlocName && b.name === excludingBlocName) continue;
    const idx = b.excess.findIndex((s) => s.node === node && s.claimedBy === null);
    if (idx < 0) continue;
    if (b.alliance === "Neutral") return true;
    if (aAll === "Neutral") return true;
    if (aAll && b.alliance === aAll) return true;
    if (aAll === null && earthBlocSocialAffinity(actor, b, cultures, ideologies) >= 1) return true;
  }
  for (const c of G.colonies) {
    if (c.id === actor.id) continue;
    if (extras(c, node) < 1) continue;
    if (!consentsExport(G, c, actor, node)) continue;
    // 0.8.3: friendly colony alt needs trade-ok partner (aff≥2 rivals / Neutral / same-bloc)
    if (sameBloc(actor, c) || socialAffinity(G, actor, c) >= 2) return true;
    const aAll = actorEarthAlliance(G, actor);
    const cAll = actorEarthAlliance(G, c);
    if (aAll === "Neutral" || cAll === "Neutral") return true;
    if (aAll && cAll && aAll === cAll) return true; // same West/East alliance
  }
  return false;
}

/**
 * Fair rule (0.7.1): opposite-alliance Earth import only if
 * 1) vital need, 2) no friendly alternative, 3) opposite excess free AND
 *    actor has &lt; MAX_OPPOSITE_EARTH_ROUTES opposite Earth routes already
 *    (default: at most 1 opposite route at a time).
 */
export function vitalAndFairOppositeEarth(
  G: GameState,
  actor: Colony,
  bloc: EarthBloc,
  node: NodeType,
  cultures: Record<string, string>,
  ideologies: Record<string, string>,
  socialAffinity: (G: GameState, a: Colony, b: Colony) => number,
  consentsExport: (G: GameState, donor: Colony, recipient: Colony, node: NodeType) => boolean
): boolean {
  if (!isVitalNeed(actor, node)) return false;
  if (
    hasFriendlyAlternative(
      G, actor, node, cultures, ideologies, socialAffinity, consentsExport, bloc.name
    )
  ) {
    return false;
  }
  if (countOppositeAllianceEarthRoutes(G, actor) >= MAX_OPPOSITE_EARTH_ROUTES) return false;
  return true;
}

/**
 * Is Earth bloc `bloc` a legal trade partner for `actor` for `node`?
 * Neutral patrons: anyone. Same alliance: yes. Opposite: vital+fair only.
 * Independents: Neutral always; East/West via culture/ideology affinity OR vital+fair.
 */
export function earthTradeAllowed(
  G: GameState,
  actor: Colony,
  bloc: EarthBloc,
  node: NodeType,
  cultures: Record<string, string>,
  ideologies: Record<string, string>,
  socialAffinity: (G: GameState, a: Colony, b: Colony) => number,
  consentsExport: (G: GameState, donor: Colony, recipient: Colony, node: NodeType) => boolean
): boolean {
  if (bloc.alliance === "Neutral") return true;
  const aAll = actorEarthAlliance(G, actor);

  if (aAll === "Neutral") return true;

  if (aAll === null) {
    // Independent
    if (earthBlocSocialAffinity(actor, bloc, cultures, ideologies) >= 1) return true;
    return vitalAndFairOppositeEarth(
      G, actor, bloc, node, cultures, ideologies, socialAffinity, consentsExport
    );
  }

  if (aAll === bloc.alliance) return true;

  // Opposite West↔East
  return vitalAndFairOppositeEarth(
    G, actor, bloc, node, cultures, ideologies, socialAffinity, consentsExport
  );
}

/** Friendly Earth for Trojan / desperation (not opposite vital+fair). */
export function isFriendlyEarthBloc(G: GameState, actor: Colony, bloc: EarthBloc,
  cultures: Record<string, string>, ideologies: Record<string, string>
): boolean {
  if (bloc.alliance === "Neutral") return true;
  const aAll = actorEarthAlliance(G, actor);
  if (aAll === "Neutral") return true;
  if (aAll && aAll === bloc.alliance) return true;
  if (aAll === null && earthBlocSocialAffinity(actor, bloc, cultures, ideologies) >= 1) return true;
  return false;
}

export function ideologyCamp(tags: string[]): "West" | "East" | "Neutral" {
  let w = 0, e = 0;
  for (const t of tags) {
    if (WEST_IDEOLOGIES.has(t)) w += 1;
    else if (EAST_IDEOLOGIES.has(t)) e += 1;
    else {
      const root = t.split("-")[0]!;
      if (WEST_IDEOLOGIES.has(root) || /Democratic|Liberal|Social Market|Pioneer|Technocrat|Market Realism/i.test(t)) w += 1;
      else if (EAST_IDEOLOGIES.has(root) || /Socialism|Putin|Platform/i.test(t)) e += 1;
    }
  }
  if (w > e && w >= 1) return "West";
  if (e > w && e >= 1) return "East";
  return "Neutral";
}

export function cultureCamp(tags: string[]): "West" | "East" | "Neutral" {
  let w = 0, e = 0;
  for (const t of tags) {
    if (WEST_CULTURES.has(t) || t.includes("Atlantic") || t.includes("American") || t.includes("European")) w += 1;
    if (EAST_CULTURES.has(t) || t.includes("Eurasian") || t.includes("Chinese") || t.includes("Russian")) e += 1;
  }
  if (w > e && w >= 1) return "West";
  if (e > w && e >= 1) return "East";
  return "Neutral";
}

/**
 * Recompute alliance pressure for Earth blocs (0.8.0 retune).
 * On Culture/Ideology develop (`force`): bump pressure toward Neutral/opposite from ideology tags.
 * End of turn: if pressure ≥ 1 (not 2), allow West/East → Neutral; Neutral → West/East
 * when majority subjects pull that way. Log every shift.
 */
export function evaluateAllianceShifts(
  G: GameState,
  cultures: Record<string, string>,
  ideologies: Record<string, string>,
  pushLog: (G: GameState, msg: string, imp?: boolean) => void,
  force = false
): void {
  if (!G.alliancePressure) G.alliancePressure = {};
  for (const bloc of G.blocs) {
    const subjects = G.colonies.filter((c) => c.patron === bloc.name);
    if (!subjects.length) {
      G.alliancePressure[bloc.name] = 0;
      continue;
    }
    const defaultAll: Alliance =
      bloc.alliance === "West" || bloc.alliance === "East" || bloc.alliance === "Neutral"
        ? bloc.alliance
        : "Neutral";

    let otherLean = 0;
    let westPull = 0;
    let eastPull = 0;
    let highFervor = 0;
    let cultureMismatch = 0;
    const opposite: Alliance =
      defaultAll === "West" ? "East" : defaultAll === "East" ? "West" : "Neutral";

    for (const c of subjects) {
      const ideoTags = [...c.ideology, ...c.ideologyImported];
      const iCamp = ideologyCamp(ideoTags);
      const cCamp = cultureCamp(c.culture);
      const homeIdeo = ideologies[bloc.name];
      const homeCult = cultures[bloc.name];
      if (homeCult && !c.culture.includes(homeCult)) cultureMismatch += 1;
      if (iCamp === "West" || cCamp === "West") westPull += 1;
      if (iCamp === "East" || cCamp === "East") eastPull += 1;
      if (defaultAll === "West" || defaultAll === "East") {
        if (iCamp === opposite || cCamp === opposite) otherLean += 1;
        if (iCamp === "Neutral" && cCamp === "Neutral") otherLean += 1; // Neutral drift
        // Soft pull to Neutral when subject ideology/culture is not home camp
        if (iCamp !== defaultAll && cCamp !== defaultAll) otherLean += 1;
      }
      if ((c.fervor || 0) >= 2) highFervor += 1;
    }

    // 0.8.0: looser signal — any lean / mismatch / fervor can build pressure
    const majorityOther = otherLean >= 1 && otherLean >= subjects.length / 2;
    const softPressure =
      otherLean >= 1 ||
      cultureMismatch >= 1 ||
      highFervor >= 1 ||
      (defaultAll !== "Neutral" && (westPull + eastPull) >= 1 && (
        (defaultAll === "West" && eastPull >= 1) ||
        (defaultAll === "East" && westPull >= 1)
      ));
    const pressure = majorityOther || softPressure;

    if (!pressure && !force) {
      G.alliancePressure[bloc.name] = Math.max(0, (G.alliancePressure[bloc.name] || 0) - 1);
      continue;
    }
    if (!pressure && force) {
      // Forced develop check: still bump if any subject pulls away from home camp
      const pullAway =
        (defaultAll === "West" && eastPull >= 1) ||
        (defaultAll === "East" && westPull >= 1) ||
        (defaultAll !== "Neutral" && cultureMismatch >= 1);
      if (!pullAway) continue;
    }

    G.alliancePressure[bloc.name] = (G.alliancePressure[bloc.name] || 0) + 1;
    const P = solarBlocParamsOf(G);
    const need = Math.max(1, Math.floor(P.alliancePressureThreshold));
    // Apply when pressure ≥ threshold; force (Culture/Ideology develop) still waits on threshold
    if ((G.alliancePressure[bloc.name] || 0) < need) continue;

    const prev = bloc.alliance;
    let shifted = false;
    if (prev === "West" || prev === "East") {
      // Mid-game Neutral softening: block early West/East → Neutral until configured turn
      if (G.turn < P.midGameNeutralSofteningTurn && !force) continue;
      if (G.turn < P.midGameNeutralSofteningTurn && force) continue;
      bloc.alliance = "Neutral";
      pushLog(
        G,
        `${bloc.name} alliance softens ${prev} → Neutral (subject ideology/culture pressure).`,
        true
      );
      shifted = true;
    } else if (prev === "Neutral") {
      let w = 0, e = 0;
      for (const c of subjects) {
        const camp = ideologyCamp([...c.ideology, ...c.ideologyImported]);
        const cc = cultureCamp(c.culture);
        if (camp === "West" || cc === "West") w += 1;
        if (camp === "East" || cc === "East") e += 1;
      }
      if (w > e && w >= Math.max(1, Math.ceil(subjects.length / 2))) {
        bloc.alliance = "West";
        pushLog(G, `${bloc.name} alliance shifts Neutral → West (subject ideology cluster).`, true);
        shifted = true;
      } else if (e > w && e >= Math.max(1, Math.ceil(subjects.length / 2))) {
        bloc.alliance = "East";
        pushLog(G, `${bloc.name} alliance shifts Neutral → East (subject ideology cluster).`, true);
        shifted = true;
      }
    }
    if (shifted) G.alliancePressure[bloc.name] = 0;
  }
}

export function pickExportLine(
  exporter: Colony,
  importer: Colony,
  opts?: { reclaimImporterId?: string; reclaimImporterLineId?: string }
): LogisticsLine | null {
  for (const line of exporter.logisticsLines) {
    if (line.lentTo || line.trojanExport || line.trojanSend) continue;
    if (line.kind === "borrowed") continue;
    // 0.8.3: one bilateral deal — no colony export on an Earth-import line
    if (line.route?.sourceKind === "earth") continue;
    // If line already imports from a colony, only allow export back to that partner
    if (
      line.route?.sourceKind === "colony" &&
      line.route.sourceId !== importer.id &&
      !(opts?.reclaimImporterId && line.route.sourceId === opts.reclaimImporterId)
    ) {
      continue;
    }
    if (line.exportRoute != null) {
      // Allow reclaim when switching the same importer's route
      if (
        opts?.reclaimImporterId &&
        line.exportRoute.colonyId === opts.reclaimImporterId &&
        (!opts.reclaimImporterLineId || line.exportRoute.importerLineId === opts.reclaimImporterLineId)
      ) {
        /* fall through */
      } else {
        continue;
      }
    }
    if (lineCanServeExport(line, exporter, importer)) return line;
  }
  return null;
}

export function clearExportToImporter(
  G: GameState,
  importerId: string,
  importerLineId?: string
): void {
  for (const c of G.colonies) {
    for (const line of c.logisticsLines) {
      if (!line.exportRoute) continue;
      if (line.exportRoute.colonyId !== importerId) continue;
      if (importerLineId && line.exportRoute.importerLineId && line.exportRoute.importerLineId !== importerLineId) {
        continue;
      }
      line.exportRoute = null;
      line.trojanExport = false;
    }
  }
}
