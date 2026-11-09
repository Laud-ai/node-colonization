/**
 * 0.8.0/0.8.1 — Founding feed (Requires+basals), solar-bloc, vital cut, unfair extraction.
 */
import type { Rng } from "./rng.js";
import type { Colony, GameState, NodeType } from "./types.js";
import { extras, freeLines, rp, strainOf } from "./nodes.js";
import { isVitalNeed, lineCanServeTrade, pickExportLine } from "./trade.js";
import {
  isIndependent, missingBasals, sameBloc, INDEPENDENT_PATRON, BASAL_NODES,
} from "./l3.js";
import {
  nationRpEarth, nationRpForColony, sameNation,
  solarBlocCooldownReady, nationColorForColony,
  solarBlocParamsOf, solarBlocMinTurn,
} from "./nation.js";
import { resolveCultureFamily } from "./naming.js";

export type V080Deps = {
  pushLog: (G: GameState, msg: string, imp?: boolean) => void;
  grantColonyImport: (
    G: GameState, recipient: Colony, lineId: string, donor: Colony, node: NodeType, rng: Rng
  ) => boolean;
  clearRouteOnLine: (G: GameState, actor: Colony, line: import("./types.js").LogisticsLine, rng: Rng, silent?: boolean) => void;
  releaseEarthClaim: (G: GameState, b: import("./types.js").EarthBloc, slotIndex: number, rng: Rng, actorName: string) => void;
  blocByName: (G: GameState, name: string) => import("./types.js").EarthBloc | undefined;
  socialAffinity: (G: GameState, a: Colony, b: Colony) => number;
  CULTURES: Record<string, string>;
};

let D: V080Deps | null = null;
export function bindV080(deps: V080Deps): void { D = deps; }
function deps(): V080Deps {
  if (!D) throw new Error("v080 not bound");
  return D;
}

/** Name a solar bloc from liege culture root. */
export function solarBlocNameFromLiege(liege: Colony): string {
  if (liege.solarBlocName) return liege.solarBlocName;
  const cult = liege.culture[0] || "Independent";
  const family = resolveCultureFamily(cult, liege.patron);
  const root = family.replace(/^Corporate\s+/, "").split(" ")[0] || "Solar";
  return `${root} Solar Bloc`;
}

/**
 * After Earth/Independent found: highest-RP same-nation sibling with free export
 * auto-starts export of child's Requires if available; else log underfed.
 */
export function tryFeedNewColony(G: GameState, child: Colony, rng: Rng): void {
  const d = deps();
  const siblings = G.colonies
    .filter((c) => c.id !== child.id && sameNation(c, child))
    .sort((a, b) => rp(b, G.bodyTF) - rp(a, G.bodyTF) || a.name.localeCompare(b.name));
  if (!siblings.length) {
    d.pushLog(G, `${child.name} founded underfed (no sibling).`, true);
    return;
  }
  // 0.8.1: try Requires first, then missing basals / Money the sibling can export
  const feedNodes: NodeType[] = [child.requires];
  for (const n of [...BASAL_NODES, "Money" as NodeType]) {
    if (n !== child.requires && extras(child, n) <= 0 && !feedNodes.includes(n)) {
      feedNodes.push(n);
    }
  }
  for (const need of feedNodes) {
    for (const sib of siblings) {
      if (extras(sib, need) < 1) continue;
      const free = freeLines(child).filter((l) =>
        lineCanServeTrade(l, child, { kind: "colony", colony: sib, node: need })
      );
      if (!free.length) continue;
      if (!pickExportLine(sib, child)) continue;
      const ok = d.grantColonyImport(G, child, free[0]!.id, sib, need, rng);
      if (ok) {
        const line = child.logisticsLines.find((l) => l.id === free[0]!.id);
        if (line?.route) {
          line.route.vital = isVitalNeed(child, need) || need === child.requires;
          for (const sl of sib.logisticsLines) {
            if (sl.exportRoute?.colonyId === child.id && sl.exportRoute.importerLineId === line.id) {
              sl.exportRoute.vital = true;
            }
          }
        }
        d.pushLog(G, `${sib.name} feeds newborn ${child.name} with ${need} (intra-nation).`, true);
        return;
      }
    }
  }
  d.pushLog(G, `${child.name} founded underfed (no basal feed available).`, true);
}

/** Tag route vital flags after start. */
export function tagRouteVital(actor: Colony, lineId: string): void {
  const line = actor.logisticsLines.find((l) => l.id === lineId);
  if (!line?.route) return;
  const vital = isVitalNeed(actor, line.route.node);
  line.route.vital = vital;
}

/** Culture+ideology affinity only (0–2), ignoring alliance/liege bloc point. */
export function cultureIdeologyAffinity(a: Colony, b: Colony): number {
  let score = 0;
  if (a.culture.some((t) => b.culture.includes(t))) score += 1;
  const ideoA = new Set([...a.ideology, ...a.ideologyImported]);
  const ideoB = new Set([...b.ideology, ...b.ideologyImported]);
  for (const tag of ideoA) {
    if (ideoB.has(tag)) { score += 1; break; }
  }
  return score;
}

function sharedActiveRoute(G: GameState, a: Colony, b: Colony): boolean {
  for (const line of a.logisticsLines) {
    if (line.route?.sourceKind === "colony" && line.route.sourceId === b.id) return true;
    if (line.exportRoute?.colonyId === b.id) return true;
  }
  for (const line of b.logisticsLines) {
    if (line.route?.sourceKind === "colony" && line.route.sourceId === a.id) return true;
    if (line.exportRoute?.colonyId === a.id) return true;
  }
  return false;
}

/**
 * Relation founding: ≥2 colonies with culture+ideology affinity ≥2 and a shared
 * active route form a Solar Bloc (Independent liege network).
 */
export function tryRelationFoundSolarBloc(G: GameState, rng: Rng): boolean {
  if (!solarBlocCooldownReady(G)) return false;
  const P = solarBlocParamsOf(G);
  if (G.turn < solarBlocMinTurn(G)) return false;
  if (G.colonies.length < P.minCitiesToFound) return false;
  const d = deps();
  const minAff = P.minRelationAffinity;
  const minFerv = P.minFervor;
  const needRoute = P.requireSharedRoute >= 1;
  const seedNeedsFervor = P.requireSeedFervor >= 1;

  // Candidates: not already Independent together
  const colonies = G.colonies.slice();
  type Pair = { a: Colony; b: Colony; aff: number };
  const pairs: Pair[] = [];
  for (let i = 0; i < colonies.length; i++) {
    for (let j = i + 1; j < colonies.length; j++) {
      const a = colonies[i]!, b = colonies[j]!;
      if (sameBloc(a, b) && isIndependent(a)) continue; // already same Independent nation
      const aff = cultureIdeologyAffinity(a, b);
      if (aff < minAff) continue;
      const shared = sharedActiveRoute(G, a, b);
      const tradeOrBody = needRoute
        ? shared
        : shared || (a.body === b.body && aff >= minAff);
      if (!tradeOrBody) continue;
      pairs.push({ a, b, aff });
    }
  }
  if (!pairs.length) return false;

  // Pick highest combined RP pair
  pairs.sort((p, q) => {
    const rpP = rp(p.a, G.bodyTF) + rp(p.b, G.bodyTF);
    const rpQ = rp(q.a, G.bodyTF) + rp(q.b, G.bodyTF);
    return rpQ - rpP;
  });
  const seed = pairs[0]!;
  const members = new Set<Colony>([seed.a, seed.b]);
  // Expand: any colony with aff≥min to the eventual liege may join if fervor gate / Independent
  const ranked = [...members].sort(
    (x, y) => rp(y, G.bodyTF) - rp(x, G.bodyTF) || x.name.localeCompare(y.name)
  );
  let liege = ranked[0]!;

  for (const c of G.colonies) {
    if (members.has(c)) continue;
    if (cultureIdeologyAffinity(c, liege) < minAff) continue;
    if ((c.fervor || 0) < minFerv && !isIndependent(c)) continue;
    const shared = sharedActiveRoute(G, c, liege);
    if (needRoute) {
      if (!shared) continue;
    } else if (!shared && c.body !== liege.body) {
      continue;
    }
    members.add(c);
  }

  // Re-pick liege as highest RP among members
  liege = [...members].sort(
    (x, y) => rp(y, G.bodyTF) - rp(x, G.bodyTF) || x.name.localeCompare(y.name)
  )[0]!;

  if (members.size < P.minMemberCount) return false;

  const joiners = [...members].filter((c) => c.id !== liege.id);
  // Opt-in: fervor / Independent; seed pair only free if requireSeedFervor is off
  const optIn = joiners.filter((c) => {
    if ((c.fervor || 0) >= minFerv || isIndependent(c)) return true;
    if (!seedNeedsFervor && (c.id === seed.a.id || c.id === seed.b.id)) return true;
    return false;
  });
  if (!optIn.length) return false;
  if (optIn.length + 1 < P.minMemberCount) return false;

  const blocName = solarBlocNameFromLiege(liege);
  liege.solarBlocName = blocName;

  // Liege becomes Independent root if not already
  if (!isIndependent(liege)) {
    const former = liege.patron;
    // Soft break: sever Earth patron links via revolution-lite without full fervor gate
    d.pushLog(G, `⚑ SOLAR BLOC: ${liege.name} forms ${blocName} (relation founding).`, true);
    // Use executeRevolution path? That severs and sets Independent. Call it.
    // But executeRevolution requires fervor — call manually:
    severAndIndep(G, liege, former, rng);
  } else if (!liege.liegeId) {
    liege.liegeId = liege.id;
  }
  liege.liegeId = liege.id;
  liege.patron = INDEPENDENT_PATRON;

  for (const c of optIn) {
    if (c.id === liege.id) continue;
    if (isIndependent(c) && c.liegeId === liege.id) continue;
    const former = c.patron;
    if (!isIndependent(c) || c.liegeId !== liege.id) {
      if (!isIndependent(c)) {
        severAndIndep(G, c, former, rng);
      } else {
        // Leave old Independent network
        c.patron = INDEPENDENT_PATRON;
      }
      c.liegeId = liege.id;
      c.patron = INDEPENDENT_PATRON;
      c.fervor = 0;
      d.pushLog(G, `${c.name} joins ${blocName} under liege ${liege.name}.`, true);
    }
  }

  G.lastSolarBlocTurn = G.turn;
  G.lastFoundTurn = G.turn; // share founding spam throttle lightly
  G.turnAnnouncements.push(`${blocName} forms around ${liege.name}.`);
  d.pushLog(
    G,
    `${blocName} founded (${optIn.length + 1} cities, nation color ${nationColorForColony(liege)}).`,
    true
  );
  return true;
}

function severAndIndep(G: GameState, c: Colony, formerPatron: string, rng: Rng): void {
  // Lightweight: cancel Earth routes from former patron and set Independent
  const d = deps();
  for (const line of [...c.logisticsLines]) {
    if (line.route?.sourceKind === "earth" && line.route.sourceId === formerPatron) {
      d.clearRouteOnLine(G, c, line, rng, false);
    }
  }
  const bloc = d.blocByName(G, formerPatron);
  if (bloc) {
    for (let i = 0; i < bloc.excess.length; i++) {
      if (bloc.excess[i]!.claimedBy === c.id) {
        d.releaseEarthClaim(G, bloc, i, rng, c.name);
      }
    }
    bloc.colonies = Math.max(0, bloc.colonies - 1);
  }
  c.patron = INDEPENDENT_PATRON;
  c.liegeId = c.id; // will be overwritten by caller for joiners
  c.fervor = 0;
}

/**
 * Late/low-colony Earth or exporter may cut a vital export to a richer nation (blackmail).
 * Rare: affinity 0 or opposite alliance.
 */
export function maybeVitalRouteCuts(G: GameState, rng: Rng): void {
  const d = deps();
  // Earth cuts: low-colony bloc with claimed vital excess to richer nation city
  for (const bloc of G.blocs) {
    if (bloc.colonies > 2) continue; // late / low-colony only
    for (let i = 0; i < bloc.excess.length; i++) {
      const slot = bloc.excess[i]!;
      if (!slot.claimedBy) continue;
      const victim = G.colonies.find((c) => c.id === slot.claimedBy);
      if (!victim) continue;
      const line = victim.logisticsLines.find(
        (l) => l.route?.sourceKind === "earth" && l.route.sourceId === bloc.name && l.route.slotIndex === i
      );
      if (!line?.route?.vital && !(line?.route && isVitalNeed(victim, line.route.node))) continue;
      // Richer nation?
      const victimNationRp = nationRpForColony(G, victim);
      const cutterNationRp = nationRpEarth(G, bloc.name);
      if (victimNationRp <= cutterNationRp) continue;
      // Opposite / low affinity
      const vAll = G.blocs.find((b) => b.name === victim.patron)?.alliance;
      if (victim.patron === bloc.name) continue; // don't cut own subjects via this path
      if (vAll && bloc.alliance !== "Neutral" && vAll !== "Neutral" && vAll === bloc.alliance) continue;
      // Rare: ~15% when conditions met (deterministic via turn+ids)
      const roll = ((G.turn * 17 + bloc.name.length * 3 + victim.id.length) % 100);
      if (roll > 15) continue;
      if (line.route) {
        line.route.threatened = true;
        d.pushLog(G, `${bloc.name} threatens vital ${line.route.node} to ${victim.name}.`, true);
      }
      d.clearRouteOnLine(G, victim, line, rng, false);
      d.pushLog(G, `⚔ blackmail cut: ${bloc.name} cuts vital route to ${victim.name}.`, true);
      if (!isIndependent(victim)) {
        d.pushLog(G, `${victim.name} pressured by blackmail cut (fervor ledger will recompute).`, true);
      }
      return; // at most one cut per turn
    }
  }

  // Colony exporter cuts vital export to outsider when affinity 0
  for (const exporter of G.colonies) {
    for (const line of exporter.logisticsLines) {
      const er = line.exportRoute;
      if (!er) continue;
      const victim = G.colonies.find((c) => c.id === er.colonyId);
      if (!victim) continue;
      if (sameNation(exporter, victim)) continue;
      const aff = d.socialAffinity(G, exporter, victim);
      if (aff !== 0) continue;
      const vital = er.vital || isVitalNeed(victim, er.node);
      if (!vital) continue;
      if (nationRpForColony(G, victim) <= nationRpForColony(G, exporter)) continue;
      const roll = ((G.turn * 13 + exporter.id.length * 7 + victim.id.length) % 100);
      if (roll > 10) continue;
      er.threatened = true;
      d.pushLog(G, `${exporter.name} threatens vital ${er.node} export to ${victim.name}.`, true);
      // Cancel victim's import
      const vLine = victim.logisticsLines.find((l) => l.id === er.importerLineId);
      if (vLine) d.clearRouteOnLine(G, victim, vLine, rng, false);
      else {
        line.exportRoute = null;
      }
      d.pushLog(G, `⚔ blackmail cut: ${exporter.name} cuts vital export to ${victim.name}.`, true);
      if (!isIndependent(victim)) {
        d.pushLog(G, `${victim.name} pressured by exporter blackmail cut.`, true);
      }
      return;
    }
  }
}

/**
 * Unfair extraction: parent/nation imports heavily from child while child lacks basals → +fervor.
 * Also: cancelling child's vital intra-nation route → +fervor (handled via flag).
 */
export function unfairExtractionFervorDelta(G: GameState, c: Colony): number {
  if (isIndependent(c)) return 0;
  const missing = missingBasals(c);
  if (!missing.length && strainOf(c) < 2) return 0;
  // Count how many exports leave this colony to same-nation (or Earth patron claims don't count as child export)
  let exportCount = 0;
  for (const line of c.logisticsLines) {
    if (!line.exportRoute) continue;
    const imp = G.colonies.find((x) => x.id === line.exportRoute!.colonyId);
    if (!imp) continue;
    if (sameNation(c, imp) || imp.patron === c.patron) exportCount += 1;
  }
  if (exportCount >= 1 && missing.length >= 2) return 1;
  if (exportCount >= 2 && (missing.length >= 1 || strainOf(c) >= 2)) return 1;
  return 0;
}

/** Call when a vital intra-nation import is cancelled by the source side / parent. */
export function onVitalIntraNationCancel(G: GameState, victim: Colony, wasVital: boolean, sourceSameNation: boolean): void {
  if (!wasVital || !sourceSameNation) return;
  if (isIndependent(victim)) return;
  // 0.8.3: unfair extraction is a ledger +1 term via computeFervorLedger; just log
  deps().pushLog(G, `${victim.name} vital intra-nation route cancelled (fervor ledger term).`, true);
}

