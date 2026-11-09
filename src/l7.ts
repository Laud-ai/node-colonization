/**
 * L7 (0.12.0) — T3 geopolitics: Earth proxy agitation + solar hegemon overturn of Earth patrons.
 * Decided by Space Game, Tiago may override (NOTES-0.12.0.md).
 */
import type { GameState } from "./types.js";
import type { Rng } from "./rng.js";
import { ruleNum, ruleOn } from "./rules.js";
import { isIndependent, executeRevolution } from "./l3.js";
import { nationRpEarth, nationRpLiege } from "./nation.js";
import { threatLevel } from "./l4.js";

type Log = (G: GameState, m: string, imp?: boolean) => void;

export function tickGeopolitics(G: GameState, rng: Rng, pushLog: Log): void {
  if (!G.rules) return;
  for (const c of G.colonies) if ((c.proxyAgitation || 0) > 0) c.proxyAgitation! -= 1;
  if (ruleOn(G, "l7Proxy")) tickProxy(G, rng, pushLog);
  if (ruleOn(G, "l7Overturn")) tickOverturn(G, rng, pushLog);
}

function campOf(G: GameState, patron: string): string | undefined {
  return G.blocs.find((b) => b.name === patron)?.alliance;
}

function tickProxy(G: GameState, rng: Rng, pushLog: Log): void {
  if (threatLevel(G) < ruleNum(G, "l7ProxyThreat")) return;
  for (const [camp, rival] of [["West", "East"], ["East", "West"]] as const) {
    const targets = G.colonies.filter((c) => !isIndependent(c) && campOf(G, c.patron) === rival);
    if (!targets.length) continue;
    const t = targets[Math.floor(rng() * targets.length)]!;
    t.proxyAgitation = Math.min(4, (t.proxyAgitation || 0) + 2);
    pushLog(G, `🕵 Proxy war: ${camp} agitates ${t.name} (${t.patron}) — agitation ${t.proxyAgitation}.`);
  }
}

function tickOverturn(G: GameState, rng: Rng, pushLog: Log): void {
  if (G.turn < ruleNum(G, "l7OverturnMinTurn")) return;
  if (G.turn - (G.lastOverturnTurn ?? -999) < 15) return;
  const lieges = [...new Set(G.colonies.filter(isIndependent).map((c) => c.liegeId).filter(Boolean) as string[])];
  const members = (id: string) => G.colonies.filter((c) => isIndependent(c) && c.liegeId === id).length;
  const strongest = lieges.filter((id) => members(id) >= 3).map((id) => ({ id, rp: nationRpLiege(G, id) })).sort((a, b) => b.rp - a.rp || a.id.localeCompare(b.id))[0];
  if (!strongest) return;
  const ratio = ruleNum(G, "l7OverturnRatio");
  const earth = [...new Set(G.colonies.filter((c) => !isIndependent(c)).map((c) => c.patron))]
    .map((p) => ({ p, rp: nationRpEarth(G, p) }))
    .filter((e) => e.rp > 0 && G.colonies.filter((c) => c.patron === e.p).length >= 2 && strongest.rp >= ratio * e.rp)
    .sort((a, b) => b.rp - a.rp)[0];
  if (!earth) return;
  const hegemon = G.colonies.find((c) => c.id === strongest.id);
  const subjects = G.colonies.filter((c) => c.patron === earth.p && !isIndependent(c));
  pushLog(G, `👑 OVERTURN: solar hegemon ${hegemon?.name ?? strongest.id} (RP ${strongest.rp}) takes ${earth.p}'s empire (RP ${earth.rp}, ${subjects.length} colonies).`, true);
  G.turnAnnouncements.push(`${hegemon?.name ?? "A solar hegemon"} overturns ${earth.p} and absorbs its colonies.`);
  for (const c of subjects) {
    executeRevolution(G, c, rng);
    c.liegeId = strongest.id;
  }
  G.lastOverturnTurn = G.turn;
}
