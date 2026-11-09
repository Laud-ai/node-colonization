import { hasThrustReach } from "./l5.js";
import { ruleNum } from "./rules.js";
/**
 * 0.8.0 — Nation identity: Earth blocs + Independent liege groups as nations/agents.
 * Colonies are cities in that nation (shared nationColor). Nation RP = sum of member colony RP.
 * 0.8.2 — founding cooldown 0; Mars lunar gate; raised Moon soft-cap.
 */
import type { Colony, EarthBloc, GameState, NodeType } from "./types.js";
import { extras, rp } from "./nodes.js";
import { BASAL_NODES, isIndependent, INDEPENDENT_PATRON } from "./l3.js";

/** Stable hex colors for Earth blocs (nations). */
export const EARTH_NATION_COLORS: Record<string, string> = {
  "United States": "#3b82f6",
  China: "#ef4444",
  "Russian Federation": "#f59e0b",
  "European Union": "#8b5cf6",
  "African Union": "#22c55e",
  "Latin Federation": "#eab308",
  "New Caliphate": "#14b8a6",
  "South Asian Commonwealth": "#f97316",
  "East Asian Pacific Alliance": "#ec4899",
  "Dominion of Indochina": "#84cc16",
  "British Commonwealth": "#6366f1",
  "United Nations": "#94a3b8",
  SpaceX: "#06b6d4",
  "Corporate China": "#dc2626",
};

/** Founding throttle knobs (0.8.2: cooldown off — 1 colony/turn). */
export const FOUNDING_COOLDOWN_TURNS = 0;
/** Soft preference toward Moon when Mars gate is open; Moon may crowd past this as Mars support. */
export const MOON_SOFT_CAP = 8;
export const SOLAR_BLOC_COOLDOWN_TURNS = 3;
export const SOLAR_BLOC_AFFINITY = 2;
export const SOLAR_BLOC_MIN_FERVOR = 2;

/**
 * Tunable solar-bloc / diplomacy timing (0.9.3).
 * Prefer params over rewriting founding logic — variants sweep these knobs.
 */
export interface SolarBlocParams {
  /** Earliest turn relation-founding a solar bloc is allowed (late-game intent). */
  minTurnToFoundBloc: number;
  /** Minimum colonies in the world before a bloc can form. */
  minCitiesToFound: number;
  /** Minimum members (liege + joiners) in the new bloc. */
  minMemberCount: number;
  /** Culture+ideology affinity gate for seed pairs / joiners. */
  minRelationAffinity: number;
  /** Fervor gate for non-seed joiners (and opt-in when requireSeedFervor). */
  minFervor: number;
  /** Turns between successive solar-bloc foundings. */
  cooldownTurns: number;
  /** If true, same-body alone is NOT enough — need an active shared route. */
  requireSharedRoute: number; // 1 = true, 0 = false (stored as number for Record merge)
  /** If 1, seed pair must also meet minFervor (no free opt-in). */
  requireSeedFervor: number;
  /** West/East → Neutral softening only at/after this turn (mid-game). */
  midGameNeutralSofteningTurn: number;
  /** Optional later window start (bloc founding uses max with minTurnToFoundBloc). */
  lateBlocWindowStart: number;
  /** Alliance pressure ticks needed before a shift applies (default 1). */
  alliancePressureThreshold: number;
}

/** Pre-0.9.3 behavior: blocs can form immediately (turn 2 bug). */
export const LEGACY_SOLAR_BLOC_PARAMS: SolarBlocParams = {
  minTurnToFoundBloc: 0,
  minCitiesToFound: 2,
  minMemberCount: 2,
  minRelationAffinity: SOLAR_BLOC_AFFINITY,
  minFervor: SOLAR_BLOC_MIN_FERVOR,
  cooldownTurns: SOLAR_BLOC_COOLDOWN_TURNS,
  requireSharedRoute: 0,
  requireSeedFervor: 0,
  midGameNeutralSofteningTurn: 0,
  lateBlocWindowStart: 0,
  alliancePressureThreshold: 1,
};

/**
 * Shipped default (0.9.3): no early blocs; mid-game Neutral softening; late founding window.
 * May be retuned after solarBlocSweep — keep id `solar_realist` in variants.
 */
export const DEFAULT_SOLAR_BLOC_PARAMS: SolarBlocParams = {
  minTurnToFoundBloc: 45,
  minCitiesToFound: 6,
  minMemberCount: 2,
  minRelationAffinity: SOLAR_BLOC_AFFINITY,
  minFervor: SOLAR_BLOC_MIN_FERVOR,
  cooldownTurns: 8,
  requireSharedRoute: 1,
  requireSeedFervor: 1,
  midGameNeutralSofteningTurn: 25,
  lateBlocWindowStart: 45,
  alliancePressureThreshold: 2,
};

export function solarBlocParamsOf(G: GameState): SolarBlocParams {
  const base: SolarBlocParams = { ...DEFAULT_SOLAR_BLOC_PARAMS };
  const over = G.solarBlocParams;
  if (!over) return base;
  for (const k of Object.keys(base) as (keyof SolarBlocParams)[]) {
    const v = over[k as string];
    if (typeof v === "number" && Number.isFinite(v)) (base as any)[k] = v;
  }
  return base;
}

export function applySolarBlocParams(
  G: GameState,
  params: Partial<SolarBlocParams>
): SolarBlocParams {
  const merged: SolarBlocParams = {
    ...DEFAULT_SOLAR_BLOC_PARAMS,
    ...(G.solarBlocParams as Partial<SolarBlocParams> | undefined),
    ...params,
  };
  G.solarBlocParams = { ...merged };
  return solarBlocParamsOf(G);
}

/** Mars gate: strong lunar basis — ≥2 Moon cities + combined Moon RP. */
export const MARS_MOON_MIN_COLONIES = 2;
export const MARS_MOON_RP_SUM = 4;

/** Deterministic color from liegeId string. */
export function colorFromLiegeId(liegeId: string): string {
  let h = 0;
  for (let i = 0; i < liegeId.length; i++) h = (h * 31 + liegeId.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const sat = 55 + (h % 25);
  const light = 42 + ((h >> 8) % 18);
  return hslToHex(hue, sat, light);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function nationColorForEarth(blocName: string): string {
  return EARTH_NATION_COLORS[blocName] ?? "#64748b";
}

/** Nation key: Earth patron name, or `ind:${liegeId}` for Independents. */
export function nationKey(c: Colony): string {
  if (isIndependent(c) && c.liegeId) return `ind:${c.liegeId}`;
  return c.patron;
}

export function nationColorForColony(c: Colony): string {
  if (isIndependent(c) && c.liegeId) return colorFromLiegeId(c.liegeId);
  return nationColorForEarth(c.patron);
}

export function sameNation(a: Colony, b: Colony): boolean {
  return nationKey(a) === nationKey(b);
}

export function nationRpEarth(G: GameState, patron: string): number {
  let sum = 0;
  for (const c of G.colonies) {
    if (c.patron === patron) sum += rp(c, G.bodyTF);
  }
  return sum;
}

export function nationRpLiege(G: GameState, liegeId: string): number {
  let sum = 0;
  for (const c of G.colonies) {
    if (c.patron === INDEPENDENT_PATRON && c.liegeId === liegeId) sum += rp(c, G.bodyTF);
  }
  return sum;
}

export function nationRpForColony(G: GameState, c: Colony): number {
  if (isIndependent(c) && c.liegeId) return nationRpLiege(G, c.liegeId);
  return nationRpEarth(G, c.patron);
}

export interface NationRpEntry {
  key: string;
  label: string;
  nationRp: number;
  nationColor: string;
  kind: "earth" | "independent";
}

export function allNationRp(G: GameState): NationRpEntry[] {
  const out: NationRpEntry[] = [];
  for (const b of G.blocs) {
    out.push({
      key: b.name,
      label: b.name,
      nationRp: nationRpEarth(G, b.name),
      nationColor: nationColorForEarth(b.name),
      kind: "earth",
    });
  }
  const seen = new Set<string>();
  for (const c of G.colonies) {
    if (!isIndependent(c) || !c.liegeId || seen.has(c.liegeId)) continue;
    seen.add(c.liegeId);
    const liege = G.colonies.find((x) => x.id === c.liegeId);
    out.push({
      key: `ind:${c.liegeId}`,
      label: liege?.name ?? c.liegeId,
      nationRp: nationRpLiege(G, c.liegeId),
      nationColor: colorFromLiegeId(c.liegeId),
      kind: "independent",
    });
  }
  return out.sort((a, b) => b.nationRp - a.nationRp || a.label.localeCompare(b.label));
}

export function leadingNation(G: GameState): NationRpEntry | null {
  const all = allNationRp(G).filter((n) => n.nationRp > 0);
  return all[0] ?? null;
}

export function moonColonyCount(G: GameState): number {
  return G.colonies.filter((c) => c.body === "Moon").length;
}

/** Moon colonies belonging to an Earth patron or Independent liege. */
export function nationMoonColonies(
  G: GameState, patron: string, liegeId?: string | null
): Colony[] {
  return G.colonies.filter((c) => {
    if (c.body !== "Moon") return false;
    if (patron === INDEPENDENT_PATRON && liegeId) {
      return c.patron === INDEPENDENT_PATRON && c.liegeId === liegeId;
    }
    return c.patron === patron;
  });
}

/** Free export slot or free logistics capacity on a colony. */
export function hasLogisticsExportCapacity(c: Colony): boolean {
  return c.logisticsLines.some(
    (l) =>
      !l.lentTo &&
      l.kind !== "borrowed" &&
      !l.trojanExport &&
      (l.exportRoute == null || l.exportRoute === undefined)
  );
}

/**
 * Strong lunar basis (0.8.2): ≥2 Moon colonies of the nation with
 * combined Moon RP ≥ MARS_MOON_RP_SUM, OR ≥2 Moon colonies each with export/logistics capacity.
 */
export function hasStrongLunarBasis(
  G: GameState, patron: string, liegeId?: string | null
): boolean {
  const moons = nationMoonColonies(G, patron, liegeId);
  if (moons.length < MARS_MOON_MIN_COLONIES) return false;
  const sumRp = moons.reduce((s, c) => s + rp(c, G.bodyTF), 0);
  if (sumRp >= MARS_MOON_RP_SUM) return true;
  const capacious = moons.filter((c) => hasLogisticsExportCapacity(c));
  return capacious.length >= MARS_MOON_MIN_COLONIES;
}

export type SocialAffinityFn = (G: GameState, a: Colony, b: Colony) => number;

/**
 * Lunar allies (0.8.2): another nation's Moon colony with socialAffinity ≥ 2
 * (or same alliance + affinity ≥ 1) that has free export slot + basal surplus.
 */
export function hasLunarAllyFeed(
  G: GameState,
  patron: string,
  socialAffinity: SocialAffinityFn,
  liegeId?: string | null
): boolean {
  const mine = nationMoonColonies(G, patron, liegeId);
  if (!mine.length) return false;
  for (const m of mine) {
    for (const other of G.colonies) {
      if (other.body !== "Moon") continue;
      if (sameNation(m, other)) continue;
      const aff = socialAffinity(G, m, other);
      let sameAlliance = false;
      if (!isIndependent(m) && !isIndependent(other)) {
        const aA = G.blocs.find((b) => b.name === m.patron)?.alliance;
        const bA = G.blocs.find((b) => b.name === other.patron)?.alliance;
        sameAlliance = !!(aA && bA && aA === bA);
      }
      if (!(aff >= 2 || (sameAlliance && aff >= 1))) continue;
      if (!hasLogisticsExportCapacity(other)) continue;
      const hasSurplus =
        BASAL_NODES.some((n) => extras(other, n) >= 1) || extras(other, "Money") >= 1;
      if (!hasSurplus) continue;
      return true;
    }
  }
  return false;
}

/** Mars founding allowed when strong lunar basis OR lunar ally feed. */
export function canFoundMars(
  G: GameState,
  patron: string,
  socialAffinity: SocialAffinityFn,
  liegeId?: string | null
): boolean {
  return (
    hasThrustReach(G, patron, liegeId) ||
    hasStrongLunarBasis(G, patron, liegeId) ||
    hasLunarAllyFeed(G, patron, socialAffinity, liegeId)
  );
}

/**
 * Body pick (0.8.2): prefer Moon until Mars gate opens for this nation;
 * once open, soft-cap MOON_SOFT_CAP then Mars. Gate closed → always Moon (crowding OK).
 */
export function foundingBodyFor(
  G: GameState,
  patron: string,
  socialAffinity: SocialAffinityFn,
  liegeId?: string | null
): "Moon" | "Mars" {
  if (!canFoundMars(G, patron, socialAffinity, liegeId)) return "Moon";
  return moonColonyCount(G) < MOON_SOFT_CAP ? "Moon" : "Mars";
}

/** @deprecated use foundingBodyFor — global soft preference without nation gate */
export function foundingBody(G: GameState): "Moon" | "Mars" {
  return moonColonyCount(G) < MOON_SOFT_CAP ? "Moon" : "Mars";
}

export function foundingCooldownReady(G: GameState): boolean {
  const last = G.lastFoundTurn ?? -999;
  if (G.rules) {
    const cd = ruleNum(G, "foundCooldownBase") + Math.floor(G.colonies.length * ruleNum(G, "foundCooldownPerColony"));
    if (cd > 0) return G.turn - last >= cd;
  }
  // 0 = allow every turn but still at most one found per turn (lastFoundTurn !== turn)
  if (FOUNDING_COOLDOWN_TURNS <= 0) return last !== G.turn;
  return G.turn - last >= FOUNDING_COOLDOWN_TURNS;
}

export function solarBlocCooldownReady(G: GameState): boolean {
  const last = G.lastSolarBlocTurn ?? -999;
  const cd = solarBlocParamsOf(G).cooldownTurns;
  return G.turn - last >= cd;
}

/** Effective earliest turn for relation-founding a solar bloc. */
export function solarBlocMinTurn(G: GameState): number {
  const P = solarBlocParamsOf(G);
  return Math.max(P.minTurnToFoundBloc, P.lateBlocWindowStart);
}

const FEED_NODES: readonly NodeType[] = [...BASAL_NODES, "Money"];

/** Sibling has basal surplus or Money ≥1 for feed. */
export function hasNationFeedSurplus(G: GameState, patron: string, exceptId?: string): boolean {
  for (const c of G.colonies) {
    if (c.patron !== patron) continue;
    if (exceptId && c.id === exceptId) continue;
    for (const n of FEED_NODES) {
      if (extras(c, n) >= 1) return true;
    }
  }
  return false;
}

export function attachNationColor(bloc: EarthBloc): string {
  return nationColorForEarth(bloc.name);
}
