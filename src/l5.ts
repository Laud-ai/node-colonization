/**
 * L5 (0.10.0) — Thrust reach + Projects (rule-changers). All behind lobby rules (rules.ts).
 * Decided by Space Game, Tiago may override (see NOTES-0.10.0.md).
 */
import type { Colony, GameState } from "./types.js";
import type { Rng } from "./rng.js";
import { extras } from "./nodes.js";
import { isIndependent } from "./l3.js";
import { ruleNum, ruleOn } from "./rules.js";

export const PROJECT_POOL = ["Orbital Shipyard", "Terraforming Megaproject", "Earth-Independent Supply Chain"] as const;
export type ProjectName = (typeof PROJECT_POOL)[number];

/** Thrust capacity: Thrust extras + finished Orbital Shipyard. */
export function thrustOf(c: Colony): number {
  return extras(c, "Thrust") + (c.projectsDone?.includes("Orbital Shipyard") ? 1 : 0);
}

/** Alternative Mars reach (adds to the lunar-basis gate): any same-nation colony with Thrust. */
export function hasThrustReach(G: GameState, patron: string, liegeId?: string | null): boolean {
  if (!G.rules || !ruleOn(G, "l5Thrust")) return false;
  return G.colonies.some((c) => (c.patron === patron || (liegeId && c.liegeId === liegeId)) && thrustOf(c) >= 1);
}

function progressGain(c: Colony): number {
  let g = extras(c, "Projects") * 2;
  if (extras(c, "Production") > 0 && extras(c, "Science") > 0) g += 1;
  return g;
}

/** End-of-turn Projects tick. */
export function tickProjects(G: GameState, rng: Rng, pushLog: (G: GameState, m: string, imp?: boolean) => void): void {
  if (!G.rules || !ruleOn(G, "l5Projects")) return;
  if (G.turn < ruleNum(G, "projectsMinTurn")) return;
  const cost = Math.max(1, ruleNum(G, "projectCost"));
  for (const c of G.colonies) {
    const done = c.projectsDone ?? [];
    if (done.length >= PROJECT_POOL.length) continue;
    const gain = progressGain(c);
    if (gain <= 0) continue;
    if (!c.projectActive) {
      const left = PROJECT_POOL.filter((p) => !done.includes(p));
      c.projectActive = left[Math.floor(rng() * left.length)]!;
      c.projectProgress = 0;
      pushLog(G, `🏗 ${c.name} begins Project: ${c.projectActive}.`);
    }
    c.projectProgress = (c.projectProgress || 0) + gain;
    if (c.projectProgress >= cost) completeProject(G, c, c.projectActive as ProjectName, pushLog);
  }
}

function completeProject(G: GameState, c: Colony, p: ProjectName, pushLog: (G: GameState, m: string, imp?: boolean) => void): void {
  c.projectsDone = [...(c.projectsDone ?? []), p];
  c.projectActive = undefined;
  c.projectProgress = 0;
  let effect = "";
  if (p === "Orbital Shipyard") effect = "+1 Thrust (independent reach)";
  else if (p === "Terraforming Megaproject") { G.bodyTF[c.body] = (G.bodyTF[c.body] || 0) + 2; effect = `${c.body} TF +2`; }
  else if (p === "Earth-Independent Supply Chain") {
    const f = ruleNum(G, "projectFervor");
    if (!isIndependent(c) && f > 0) effect = `"we built this ourselves" fervor +${f} (standing)`;
    else effect = "self-reliant supply";
  }
  pushLog(G, `🏗 PROJECT: ${c.name} completes ${p} (${effect}).`, true);
}
