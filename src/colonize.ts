/**
 * 0.21.0 Living Colony — colonization waves (Rules group "Colonization", each its own toggle; all off = 0.20.0).
 * - `colonizationWaves`: a pressure meter per Earth bloc (base + filled Earth node slots + rival colonies on reachable
 *   bodies where the bloc has none; ×boost with zero colonies). Crossing the threshold founds (bypassing the tech cap)
 *   and resets. A bloc's first colony skips the founding cooldown; later ones wait for it.
 * - `firstFoundingWave`: a bloc's first colony on a body is tax-free and opens a short window of cheap / fast founding
 *   there (no tax, no cooldown, lower threshold, faster meter), stronger the more rival colonies are already there.
 * - `daughterColonies`: a colony ≥ `daughterMinLevel` with a free line spends it to seed a daughter on its body or one
 *   step out (Moon→Mars, Mars→belt with belt reach); the first daughter on a new body starts a wave.
 * - Brakes: a wave ends when the founder can't supply its colonies; `foundPerBlocPerTurn` per bloc per turn.
 * Wave / daughter colonies are ordinary colonies (Tiago: rushed colonies are NOT less loyal).
 */
import type { Body, Colony, EarthBloc, GameState } from "./types.js";
import type { Rng } from "./rng.js";
import { ruleNum, ruleOn } from "./rules.js";
import { colonyLevel, rp, strainOf } from "./nodes.js";
import { isIndependent, freeOwnNonBaseLines } from "./l3.js";
import { canFoundMars, canFoundBelt, beltReachOf, foundingBodyFor, foundingCooldownReady, hasNationFeedSurplus } from "./nation.js";
import { tryFeedNewColony } from "./v080.js";
import {
  pushLog, makeColony, foundingTax, isUncappedFounder, socialAffinity, rollSpecialtyRequiresForPatron, tryFound,
  CULTURES, IDEOLOGIES, blocByName, clearRouteOnLine,
} from "./engine.js";

const on = (G: GameState, id: string) => !!G.rules && ruleOn(G, id);
export function colonizationOn(G: GameState): boolean {
  return on(G, "colonizationWaves") || on(G, "firstFoundingWave") || on(G, "daughterColonies");
}

const ownCols = (G: GameState, bloc: string) => G.colonies.filter((c) => c.patron === bloc && !c.nomad);
function bodyOpen(G: GameState, bloc: string, body: Body): boolean {
  if (body === "Moon") return true;
  if (body === "Mars") return canFoundMars(G, bloc, socialAffinity);
  return canFoundBelt(G, bloc);
}
/** Rival colonies on reachable bodies where the bloc has no colony. */
export function rivalPull(G: GameState, bloc: string): number {
  let n = 0;
  for (const body of ["Moon", "Mars", "Belt"] as Body[]) {
    if (ownCols(G, bloc).some((c) => c.body === body) || !bodyOpen(G, bloc, body)) continue;
    n += G.colonies.filter((c) => c.body === body && c.patron !== bloc && !c.nomad).length;
  }
  return n;
}
export function pressureRate(G: GameState, b: EarthBloc): number {
  const filled = b.excess.filter((s) => s.claimedBy).length;
  let r = ruleNum(G, "pressureBase") + ruleNum(G, "pressurePerSlot") * filled + ruleNum(G, "pressurePerRival") * rivalPull(G, b.name);
  if (!ownCols(G, b.name).length) r *= ruleNum(G, "pressureZeroBoost");
  const w = G.waves?.[b.name];
  // wave: faster meter, plus a catch-up push that fills the wave threshold within the window at full strength
  if (w && G.turn <= w.until) r = r * (1 + w.strength) + w.strength * ruleNum(G, "pressureThreshold") * ruleNum(G, "waveThresholdFactor") / Math.max(1, ruleNum(G, "waveTurns"));
  return r;
}
/** Colonies ever founded by the bloc (revolutions don't reset it). */
const foundedBy = (G: GameState, bloc: string) => G.blocFounded?.[bloc] ?? 0;
function syncFounded(G: GameState): void {
  const f = (G.blocFounded ??= {});
  const seen = (G.__seenColonies ??= new Set<string>());
  for (const c of G.colonies) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    if (c.patron !== "Independent" && !c.nomad) f[c.patron] = (f[c.patron] ?? 0) + 1;
  }
}
const supplyOk = (G: GameState, bloc: string) => ownCols(G, bloc).length < 2 || hasNationFeedSurplus(G, bloc);
const thrFor = (G: GameState, bloc: string) => ruleNum(G, "pressureThreshold") * (1 + ruleNum(G, "pressureGrowth") * foundedBy(G, bloc));
const capOk = (G: GameState, bloc: string) => (G.foundThisTurn?.[bloc] ?? 0) < ruleNum(G, "foundPerBlocPerTurn");

function openWave(G: GameState, bloc: string, body: Body, trigger: string): void {
  if (!on(G, "firstFoundingWave")) return;
  const rivals = G.colonies.filter((c) => c.body === body && c.patron !== bloc && !c.nomad).length;
  const strength = Math.min(1, ruleNum(G, "waveRivalScale") * rivals);
  const until = G.turn + ruleNum(G, "waveTurns") + Math.floor(strength / 0.5) * 2;
  (G.waves ??= {})[bloc] = { body, start: G.turn, until, strength, founded: 0, trigger };
  pushLog(G, `🌊 WAVE: ${bloc} opens a colonization wave on ${body} (strength ${strength.toFixed(2)}, ${rivals} rival colon${rivals === 1 ? "y" : "ies"}; until T${until}).`, true);
}

/** Found one colony for `bloc` (pressure / wave / daughter). Returns the colony. */
export function foundFor(G: GameState, b: EarthBloc, rng: Rng, o: { body?: Body; tags: string[]; parent?: Colony }): Colony {
  const body = o.body ?? foundingBodyFor(G, b.name, socialAffinity);
  const first = !ownCols(G, b.name).some((c) => c.body === body);
  const wave = G.waves?.[b.name];
  const inWave = !!wave && wave.body === body && G.turn <= wave.until;
  const tags = [...o.tags];
  if (first && on(G, "firstFoundingWave")) tags.push("first");
  const free = o.parent || (first && on(G, "firstFoundingWave")) || inWave;
  const tax = free ? 0 : Math.min(b.tech, foundingTax(b));
  const { specialty, requires } = rollSpecialtyRequiresForPatron(G, b.name, rng);
  const col = makeColony(G, {
    patron: b.name, body, specialty, requires,
    culture: o.parent ? o.parent.culture.slice() : [CULTURES[b.name] || "Mixed"],
    ideology: o.parent ? o.parent.ideology.slice() : [IDEOLOGIES[b.name] || "Localism"],
    rng,
  });
  col.foundTags = tags;
  if (o.parent) { col.parentId = o.parent.id; o.parent.lastDaughterTurn = G.turn; }
  G.colonies.push(col);
  b.colonies += 1;
  if (!isUncappedFounder(b.name)) b.tech = Math.max(0, b.tech - tax);
  G.lastFoundTurn = G.turn;
  (G.foundThisTurn ??= {})[b.name] = (G.foundThisTurn[b.name] ?? 0) + 1;
  if (inWave) wave!.founded++;
  const how = o.parent ? `daughter of ${o.parent.name}` : tags.includes("wave") ? "colonization wave" : "colonization pressure";
  pushLog(G, `${b.name} founds ${col.name} on ${body} [${specialty}, needs ${requires}] (${how}${tags.includes("first") ? ", first on the body" : ""}). Founding tax ${tax}.`, true);
  G.pendingFoundings.push({ patron: b.name, colonyName: col.name, body, turn: G.turn });
  tryFeedNewColony(G, col, rng);
  if (first) openWave(G, b.name, body, o.parent ? "daughter" : "first colony");
  return col;
}

function daughterBody(G: GameState, p: Colony): Body {
  const has = (body: Body) => ownCols(G, p.patron).some((c) => c.body === body);
  if (p.body === "Moon" && !has("Mars") && canFoundMars(G, p.patron, socialAffinity)) return "Mars";
  if (p.body === "Mars" && !has("Belt") && beltReachOf(G, p)) return "Belt";
  return p.body;
}
function daughterLine(p: Colony) {
  return freeOwnNonBaseLines(p).filter((l) => !l.exportRoute);
}
export function canSeedDaughter(G: GameState, p: Colony): boolean {
  if (!on(G, "daughterColonies") || isIndependent(p) || p.nomad || p.oxygenCrisis) return false;
  if (colonyLevel(p) < ruleNum(G, "daughterMinLevel")) return false;
  if ((p.foodClock || 0) > 0 || (p.waterClock || 0) > 0 || (p.oxygenClock || 0) > 0) return false;
  if (G.turn - (p.lastDaughterTurn ?? -999) < ruleNum(G, "daughterCooldown")) return false;
  return (daughterLine(p).length > 0 || !!freeableLine(p)) && !!blocByName(G, p.patron);
}
/** A non-vital import (not Requires, not a relay / lent / borrowed line) the parent can drop to seed. */
function freeableLine(p: Colony) {
  return p.logisticsLines.find((l) => l.route && !l.route.vital && l.route.node !== p.requires && !l.relay && !l.relayTo && !l.lentTo
    && l.kind !== "base" && l.kind !== "borrowed" && !l.exportRoute && !l.trojanSend && !l.trojanExport);
}
function seedDaughter(G: GameState, p: Colony, rng: Rng, body: Body): Colony | null {
  if (!daughterLine(p).length) {
    const f = freeableLine(p);
    if (!f) return null;
    pushLog(G, `${p.name} drops its ${f.route!.node} import on ${f.name} to seed a daughter.`, true);
    clearRouteOnLine(G, p, f, rng, true);
  }
  const line = daughterLine(p)[0];
  if (!line) return null;
  p.logisticsLines.splice(p.logisticsLines.indexOf(line), 1);
  pushLog(G, `${p.name} spends ${line.name} to seed a daughter colony.`, true);
  return foundFor(G, blocByName(G, p.patron)!, rng, { body, tags: ["daughter"], parent: p });
}

/** Founding phase of finishTurn (replaces tryFound when any colonization rule is on). */
export function colonizationPhase(G: GameState, rng: Rng): void {
  if (!colonizationOn(G)) { tryFound(G, rng); return; }
  G.foundThisTurn = {};
  syncFounded(G);
  const thrOf = (bloc: string) => ruleNum(G, "pressureThreshold") * (1 + ruleNum(G, "pressureGrowth") * foundedBy(G, bloc));
  // wave upkeep + supply brake
  for (const [bloc, w] of Object.entries(G.waves ?? {})) {
    if (G.turn > w.until) { delete G.waves![bloc]; pushLog(G, `🌊 WAVE ends: ${bloc} on ${w.body} (${w.founded} wave colon${w.founded === 1 ? "y" : "ies"}).`); continue; }
    if (!supplyOk(G, bloc)) { delete G.waves![bloc]; pushLog(G, `🌊 WAVE stalls: ${bloc} can't supply its new colonies on ${w.body}.`, true); }
  }
  const P = (G.pressure ??= {});
  if (on(G, "colonizationWaves")) {
    for (const b of G.blocs) P[b.name] = (P[b.name] ?? 0) + pressureRate(G, b);
    // A) waves: fast + cheap on the wave body (no cooldown)
    for (const b of G.blocs) {
      const w = G.waves?.[b.name];
      if (!w || w.founded >= ruleNum(G, "waveMaxColonies")) continue;
      if ((P[b.name] ?? 0) < ruleNum(G, "pressureThreshold") * ruleNum(G, "waveThresholdFactor") || !capOk(G, b.name) || !bodyOpen(G, b.name, w.body)) continue;
      foundFor(G, b, rng, { body: w.body, tags: ["wave"] });
      syncFounded(G);
      P[b.name] = 0;
    }
    // B) pressure: first colony skips the cooldown, later ones wait for it; supply brake
    const ready = G.blocs.filter((b) => (P[b.name] ?? 0) >= thrOf(b.name) && capOk(G, b.name))
      .sort((a, b) => (P[b.name] ?? 0) - (P[a.name] ?? 0) || a.name.localeCompare(b.name));
    let firsts = 0;
    for (const b of ready) {
      const firstEver = foundedBy(G, b.name) === 0;
      if (firstEver && firsts >= 1) continue; // one first colony per turn (staggered)
      if (!firstEver && (!foundingCooldownReady(G) || !supplyOk(G, b.name))) { P[b.name] = Math.min(P[b.name]!, thrOf(b.name)); continue; }
      if (firstEver) firsts++;
      foundFor(G, b, rng, { tags: ["pressure"] });
      syncFounded(G);
      P[b.name] = 0;
    }
  }
  // C) daughters from colonies that still hold a free (or droppable) line at the end of the turn
  if (on(G, "daughterColonies") && G.daughterTurn !== G.turn) {
    const parents = G.colonies.filter((c) => canSeedDaughter(G, c)).sort((x, y) => colonyLevel(y) - colonyLevel(x) || x.id.localeCompare(y.id));
    for (const p of parents) if (tryDaughterAction(G, p, rng)) break;
  }
  // D) 0.20.0 tech-cap founding when nothing else founded this turn
  if (!Object.keys(G.foundThisTurn).length) tryFound(G, rng);
  syncFounded(G);
}

/**
 * Daughter seeding as the colony's own action (autoAct step 3, after it tried to fill its needs, like Independent
 * founding): spends a free line. Waits for the founding cooldown unless the target body has the bloc's open wave.
 */
export function tryDaughterAction(G: GameState, p: Colony, rng: Rng): boolean {
  if (!canSeedDaughter(G, p) || !capOk(G, p.patron) || !supplyOk(G, p.patron)) return false;
  if (on(G, "colonizationWaves") && (G.pressure?.[p.patron] ?? 0) < thrFor(G, p.patron) * ruleNum(G, "daughterPressure")) return false;
  const body = daughterBody(G, p);
  const w = G.waves?.[p.patron];
  // own throttle instead of the shared founding cooldown: one daughter per turn in the whole system
  if (G.daughterTurn === G.turn) return false;
  if (!seedDaughter(G, p, rng, body)) return false;
  G.daughterTurn = G.turn;
  if (G.pressure && G.pressure[p.patron] !== undefined) G.pressure[p.patron] = 0;
  return true;
}
