import { ruleNum, ruleOn } from "./rules.js";
/**
 * L4 / 0.9.0 — Survival clocks, refugees, Military invade, threat track, TF livable,
 * editable independence threshold.
 */
import type { Rng } from "./rng.js";
import { extras, strainOf, rp, freeLines, activeImportCount } from "./nodes.js";
import type { Body, Colony, GameState, NodeType } from "./types.js";
import {
  FERVOR_THRESHOLD,
  INDEPENDENT_PATRON,
  independenceThresholdOf,
  isIndependent,
  sameBloc,
} from "./l3.js";
import { sameNation } from "./nation.js";

/** Default independence fervor threshold (editable via G.independenceThreshold). */
export const DEFAULT_INDEPENDENCE_THRESHOLD = FERVOR_THRESHOLD;

/** Clock trips refugee at this value. */
export const SURVIVAL_CLOCK_TRIP = 3;

/** bodyTF ≥ this → livable (Oxygen off; refugees may found Independent). */
export const TF_LIVABLE = 10;

/** Destroy priority when invader strikes (developed nodes only). */
export const INVADE_DESTROY_PRIORITY: readonly NodeType[] = [
  "Infrastructure", "Energy", "Resources", "Logistics", "Production", "Food", "Water",
] as const;

/** Earth West↔East threat track key. */
export const EARTH_THREAT_KEY = "West|East";

export type SurvivalClockKind = "food" | "water" | "oxygen";

/** Minimal engine deps for L4 (avoid circular imports). */
export interface L4Deps {
  pushLog: (G: GameState, msg: string, imp?: boolean) => void;
  makeColony: (G: GameState, cfg: {
    patron: string; body: Body; specialty: NodeType; requires: NodeType;
    culture: string[]; ideology: string[]; name?: string; liegeId?: string | null;
    rng?: Rng;
  }) => Colony;
  IDEOLOGIES: Record<string, string>;
  blocByName: (G: GameState, name: string) => { name: string; alliance: string; colonies: number } | undefined;
  socialAffinity: (G: GameState, a: Colony, b: Colony) => number;
  clearRouteOnLine: (G: GameState, actor: Colony, line: import("./types.js").LogisticsLine, rng: Rng, silent?: boolean) => void;
  findLine: (c: Colony, lineId: string) => import("./types.js").LogisticsLine | undefined;
  foundingCooldownReady?: (G: GameState) => boolean;
}

let D: L4Deps | null = null;

export function bindL4(deps: L4Deps): void {
  D = deps;
}
function deps(): L4Deps {
  if (!D) throw new Error("L4 not bound — call bindL4 from engine");
  return D;
}

export { independenceThresholdOf };

export function setIndependenceThreshold(G: GameState, value: number): number {
  const v = Math.max(1, Math.min(99, Math.floor(Number(value) || DEFAULT_INDEPENDENCE_THRESHOLD)));
  G.independenceThreshold = v;
  if (G.fervorParams) G.fervorParams = { ...G.fervorParams, threshold: v };
  return v;
}

/** Health cover for L4 clock slowing = Stability extras (specialty counts). */
export function hasHealth(c: Colony): boolean {
  return extras(c, "Stability") >= 1;
}

export function isBodyLivable(G: GameState, body: Body): boolean {
  return (G.bodyTF[body] || 0) >= TF_LIVABLE;
}

/** Military invasion token: developed/import/specialty Military (unless specialty token burned). */
export function hasInvasionToken(c: Colony): boolean {
  const developed = c.developed.Military || 0;
  const imported = activeImportCount(c, "Military");
  const specialty = c.specialty === "Military" && !c.militaryTokenBurned ? 1 : 0;
  return developed + imported + specialty >= 1;
}

/** Inherent local defense flavor (not a node) — documented; RP compare uses raw rp(). */
export const STATIONED_DEFENSE = 1;

export function burnMilitaryToken(G: GameState, c: Colony, rng?: Rng): boolean {
  const d = deps();
  const r = rng ?? mulberryStub(G);
  if ((c.developed.Military || 0) >= 1) {
    c.developed.Military -= 1;
    d.pushLog(G, `${c.name} loses 1 developed Military (invasion token burned).`, true);
    return true;
  }
  // Cancel one Military import route if any
  for (const line of c.logisticsLines) {
    if (line.route?.node === "Military" && !line.trojanSend) {
      d.clearRouteOnLine(G, c, line, r, false);
      d.pushLog(G, `${c.name} loses Military import (invasion token burned).`, true);
      return true;
    }
  }
  if (c.specialty === "Military" && !c.militaryTokenBurned) {
    c.militaryTokenBurned = true;
    d.pushLog(G, `${c.name} Military specialty token spent (burned until redeveloped).`, true);
    return true;
  }
  return false;
}

/** Tiny deterministic rng when clearRoute needs one outside caller scope. */
function mulberryStub(G: GameState): Rng {
  let s = ((G.seed ^ (G.turn * 9973)) >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function destroyOneDevelopedNode(G: GameState, c: Colony): NodeType | null {
  const d = deps();
  const tryDestroy = (n: NodeType): boolean => {
    if ((c.developed[n] || 0) < 1) return false;
    c.developed[n] -= 1;
    if (n === "Logistics") {
      // Remove one develop logistics line if present
      const idx = c.logisticsLines.findIndex((l) => l.kind === "develop" && !l.route && !l.lentTo && !l.trojanSend);
      if (idx >= 0) {
        c.logisticsLines.splice(idx, 1);
        d.pushLog(G, `${c.name} loses a logistics works line.`, true);
      }
    }
    d.pushLog(G, `${c.name} loses developed ${n} to invasion strike.`, true);
    return true;
  };
  for (const n of INVADE_DESTROY_PRIORITY) {
    if (tryDestroy(n)) return n;
  }
  for (const n of Object.keys(c.developed) as NodeType[]) {
    if (tryDestroy(n)) return n;
  }
  return null;
}

export function threatLevel(G: GameState): number {
  return G.threatTrack?.[EARTH_THREAT_KEY] ?? 0;
}

export function raiseEarthThreat(G: GameState, attacker: Colony, defender: Colony): void {
  const d = deps();
  const aA = d.blocByName(G, attacker.patron)?.alliance;
  const bA = d.blocByName(G, defender.patron)?.alliance;
  if (!aA || !bA) return; // Independents do not raise Earth threat
  if (!((aA === "West" && bA === "East") || (aA === "East" && bA === "West"))) return;
  if (!G.threatTrack) G.threatTrack = {};
  const cur = G.threatTrack[EARTH_THREAT_KEY] ?? 0;
  const next = Math.min(3, cur + 1);
  G.threatTrack[EARTH_THREAT_KEY] = next;
  if (next >= 3) {
    d.pushLog(G, `⚠ Threat critical (West↔East = ${next}) — stand down; further West↔East invasions blocked until decay.`, true);
    G.turnAnnouncements.push(`Threat critical: West↔East stand down.`);
  } else {
    d.pushLog(G, `Earth threat West↔East → ${next}.`, true);
  }
}

export function decayThreatTrack(G: GameState): void {
  if (!G.threatTrack) return;
  for (const k of Object.keys(G.threatTrack)) {
    const v = G.threatTrack[k] ?? 0;
    if (v > 0) G.threatTrack[k] = v - 1;
  }
}

export function westEastInvadeBlocked(G: GameState, attacker: Colony, defender: Colony): boolean {
  if (threatLevel(G) < 3) return false;
  const d = deps();
  const aA = d.blocByName(G, attacker.patron)?.alliance;
  const bA = d.blocByName(G, defender.patron)?.alliance;
  if (!aA || !bA) return false;
  return (aA === "West" && bA === "East") || (aA === "East" && bA === "West");
}

export function canInvade(G: GameState, attacker: Colony, defender: Colony): boolean {
  if (attacker.id === defender.id) return false;
  if (attacker.acted) return false;
  if (!hasInvasionToken(attacker)) return false;
  if (sameNation(attacker, defender)) return false; // cross-nation only (v1)
  if (attacker.body !== defender.body) return false; // same body v1
  if (westEastInvadeBlocked(G, attacker, defender)) return false;
  return true;
}

export function listInvadeTargets(G: GameState, attacker: Colony): Colony[] {
  return G.colonies
    .filter((c) => canInvade(G, attacker, c))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Invade resolution (Tiago):
 * 1. Destroy one defender developed node
 * 2. Higher RP wins; tie → defender
 * 3. Invader wins → flip patron/liege + ideology[0]
 * 4. Defender wins → burn attacker Military token
 */
export function invade(G: GameState, attacker: Colony, defender: Colony, _rng: Rng): boolean {
  if (!canInvade(G, attacker, defender)) return false;
  const d = deps();
  d.pushLog(G, `⚔ ${attacker.name} invades ${defender.name}!`, true);

  destroyOneDevelopedNode(G, defender);

  const rpA = rp(attacker, G.bodyTF);
  const rpD = rp(defender, G.bodyTF);
  const invaderWins = rpA > rpD; // tie → defender

  raiseEarthThreat(G, attacker, defender);

  if (invaderWins) {
    annexColony(G, attacker, defender);
    d.pushLog(
      G,
      `⚑ ${attacker.name} annexes ${defender.name} (RP ${rpA} > ${rpD}). Ideology + nation flipped.`,
      true
    );
    G.turnAnnouncements.push(`${attacker.name} annexes ${defender.name}.`);
  } else {
    burnMilitaryToken(G, attacker, _rng);
    d.pushLog(
      G,
      `🛡 ${defender.name} repels ${attacker.name} (RP ${rpD} ≥ ${rpA}). Invader Military burned.`,
      true
    );
  }
  attacker.acted = true;
  return true;
}

export function annexColony(G: GameState, victor: Colony, defender: Colony): void {
  const d = deps();
  const formerPatron = defender.patron;
  const formerLiege = defender.liegeId;

  if (isIndependent(victor)) {
    defender.patron = INDEPENDENT_PATRON;
    defender.liegeId = victor.liegeId || victor.id;
    if (formerPatron !== INDEPENDENT_PATRON) {
      const bloc = d.blocByName(G, formerPatron);
      if (bloc) bloc.colonies = Math.max(0, bloc.colonies - 1);
    }
  } else {
    defender.patron = victor.patron;
    defender.liegeId = null;
    if (formerPatron === INDEPENDENT_PATRON) {
      // leave Independent count implicit
    } else if (formerPatron !== victor.patron) {
      const oldB = d.blocByName(G, formerPatron);
      if (oldB) oldB.colonies = Math.max(0, oldB.colonies - 1);
      const newB = d.blocByName(G, victor.patron);
      if (newB) newB.colonies += 1;
    }
  }

  const gov =
    victor.ideology[0] ||
    d.IDEOLOGIES[victor.patron] ||
    "Localism";
  if (defender.ideology.length === 0) defender.ideology = [gov];
  else defender.ideology[0] = gov;

  defender.fervor = 0;
  d.pushLog(
    G,
    `${defender.name} allegiances flip: ${formerPatron}${formerLiege ? `/${formerLiege}` : ""} → ${defender.patron}${defender.liegeId ? `/${defender.liegeId}` : ""}; ideology[0]=${gov}.`,
    true
  );
}

/** Ensure clock fields exist. */
export function ensureClocks(c: Colony): void {
  if (c.foodClock == null) c.foodClock = 0;
  if (c.waterClock == null) c.waterClock = 0;
  if (c.oxygenClock == null) c.oxygenClock = 0;
}

/**
 * Tick survival clocks once per colony action/turn.
 * Health (Stability): clocks advance only on odd turns (every other turn).
 */
export function tickSurvivalClocks(G: GameState, c: Colony, rng: Rng): void {
  ensureClocks(c);
  if (strainOf(c) <= 0) return;
  if (hasHealth(c) && G.turn % 2 === 0) return; // every other turn

  const lacking = (n: NodeType) => extras(c, n) <= 0;
  const trip = G.rules ? ruleNum(G, "refugeeClockTrip") : SURVIVAL_CLOCK_TRIP;
  const cdOk0 = () => !G.rules || G.turn - (c.lastRefugeeTurn ?? -999) >= ruleNum(G, "refugeeColonyCooldown");
  const recover = !!G.rules && ruleOn(G, "refugeeClockRecovery");
  const fire = (k: SurvivalClockKind) => { emitRefugees(G, c, k, rng); c.lastRefugeeTurn = G.turn; };
  if (recover) {
    if (!lacking("Food") && (c.foodClock || 0) > 0) c.foodClock! -= 1;
    if (!lacking("Water") && (c.waterClock || 0) > 0) c.waterClock! -= 1;
    if ((isBodyLivable(G, c.body) || !lacking("Oxygen")) && (c.oxygenClock || 0) > 0) c.oxygenClock! -= 1;
  }

  if (lacking("Food")) {
    c.foodClock = (c.foodClock || 0) + 1;
    if ((c.foodClock || 0) >= trip && cdOk0()) {
      fire("food");
      c.foodClock = 0;
    }
  }
  if (lacking("Water")) {
    c.waterClock = (c.waterClock || 0) + 1;
    if ((c.waterClock || 0) >= trip && cdOk0()) {
      fire("water");
      c.waterClock = 0;
    }
  }
  if (!isBodyLivable(G, c.body) && lacking("Oxygen")) {
    c.oxygenClock = (c.oxygenClock || 0) + 1;
    if ((c.oxygenClock || 0) >= trip && cdOk0()) {
      fire("oxygen");
      c.oxygenClock = 0;
    }
  }
}

function reducePopulationOrStress(G: GameState, c: Colony, rng: Rng): void {
  const d = deps();
  if ((c.developed.Population || 0) >= 1) {
    c.developed.Population -= 1;
    d.pushLog(G, `${c.name} loses 1 Population (refugees flee).`, true);
    return;
  }
  for (const line of c.logisticsLines) {
    if (line.route?.node === "Population" && !line.trojanSend) {
      d.clearRouteOnLine(G, c, line, rng, false);
      d.pushLog(G, `${c.name} loses Population import (refugees flee).`, true);
      return;
    }
  }
  c.populationStress = (c.populationStress || 0) + 1;
  d.pushLog(G, `${c.name} population stress +1 (no Population extra to lose).`, true);
}

/**
 * Refugee event: reduce Population / stress; seek home by priority.
 */
export function emitRefugees(
  G: GameState, origin: Colony, reason: SurvivalClockKind, rng: Rng
): void {
  const d = deps();
  d.pushLog(G, `🏕 Refugees flee ${origin.name} (${reason} clock).`, true);
  G.turnAnnouncements.push(`Refugees from ${origin.name} (${reason}).`);
  reducePopulationOrStress(G, origin, rng);

  const cultureTags = origin.culture.slice();
  const body = origin.body;

  // 1) Same-body city with Food/Water extras
  const sameBody = G.colonies
    .filter((c) => c.id !== origin.id && c.body === body && (extras(c, "Food") >= 1 || extras(c, "Water") >= 1))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const host of sameBody) {
    if (tryAcceptRefugees(G, host, origin, cultureTags, rng, true)) return;
  }

  // 2) Any willing city
  const others = G.colonies
    .filter((c) => c.id !== origin.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const host of others) {
    if (tryAcceptRefugees(G, host, origin, cultureTags, rng, false)) return;
  }

  // 3) Livable body → optional Independent Resources found
  if (isBodyLivable(G, body)) {
    if (tryRefugeeIndependentFound(G, body, cultureTags, origin, rng)) return;
  }

  d.pushLog(G, `Refugees from ${origin.name} stranded (no willing host).`, true);
}

/**
 * Accept rules:
 * - Same nation (patron/liege): auto-accept if free logistics
 * - Cross-nation: accept if affinity≥2 and free logistics (auto); else refuse
 */
export function tryAcceptRefugees(
  G: GameState,
  host: Colony,
  origin: Colony,
  cultureTags: string[],
  _rng: Rng,
  preferSameBody: boolean
): boolean {
  const d = deps();
  const free = freeLines(host).filter((l) => l.kind !== "borrowed");
  const hasCapacity = free.length > 0;

  if (sameNation(host, origin) || sameBloc(host, origin)) {
    if (!hasCapacity) return false;
    acceptRefugeesInto(G, host, origin, cultureTags, true);
    return true;
  }

  const aff = d.socialAffinity(G, host, origin);
  if (aff >= 2 && hasCapacity) {
    acceptRefugeesInto(G, host, origin, cultureTags, false);
    return true;
  }

  if (preferSameBody) {
    // soft refuse — try next same-body
    return false;
  }
  return false;
}

function acceptRefugeesInto(
  G: GameState, host: Colony, origin: Colony, cultureTags: string[], freeLogistics: boolean
): void {
  const d = deps();
  for (const tag of cultureTags) {
    if (tag && !host.culture.includes(tag)) host.culture.push(tag);
  }
  // Occupy attention: mark acted unless free same-nation logistics path
  if (!freeLogistics) {
    // costs attention — if host hasn't acted, consume; else just log
    if (!host.acted) host.acted = true;
  }
  d.pushLog(
    G,
    `${host.name} accepts refugees from ${origin.name}` +
      (cultureTags.length ? ` (culture +${cultureTags.filter((t) => host.culture.includes(t)).join("/")})` : "") +
      `.`,
    true
  );
}

export function tryRefugeeIndependentFound(
  G: GameState, body: Body, cultureTags: string[], origin: Colony, rng: Rng
): boolean {
  const d = deps();
  const last = G.lastRefugeeFoundTurn ?? -999;
  if (G.turn - last < 2) return false; // cooldown
  if (d.foundingCooldownReady && !d.foundingCooldownReady(G)) return false;

  const col = d.makeColony(G, {
    patron: INDEPENDENT_PATRON,
    body,
    specialty: "Resources",
    requires: "Infrastructure",
    culture: cultureTags.length ? cultureTags.slice() : ["Mixed"],
    ideology: ["Localism"],
    liegeId: null, // self after push
    rng,
  });
  col.liegeId = col.id;
  G.colonies.push(col);
  G.lastFoundTurn = G.turn;
  G.lastRefugeeFoundTurn = G.turn;
  d.pushLog(
    G,
    `Refugees from ${origin.name} found Independent ${col.name} on livable ${body} [Resources].`,
    true
  );
  G.pendingFoundings.push({
    patron: INDEPENDENT_PATRON,
    colonyName: col.name,
    body,
    turn: G.turn,
  });
  return true;
}

/** Rare autoAct invade: Military token + hostile same-body target. */
export function maybeAutoInvade(G: GameState, actor: Colony, rng: Rng): boolean {
  if (!hasInvasionToken(actor)) return false;
  const targets = listInvadeTargets(G, actor);
  if (!targets.length) return false;
  // ~8% chance when eligible
  if (rng() >= 0.08) return false;
  // Prefer lowest RP target
  targets.sort((a, b) => rp(a, G.bodyTF) - rp(b, G.bodyTF) || a.name.localeCompare(b.name));
  const t = targets[0]!;
  return invade(G, actor, t, rng);
}

