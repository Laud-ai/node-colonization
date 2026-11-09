/** 0.15.0 — Builds flag inputs from game state (lineage = presentation only; no RNG, no rule effects). */
import type { Colony, GameState } from "./types.js";
import { blocFlag, colonyFlag, type FlagDesign, type FlagInput } from "./flagDesign.js";

function originOf(c: Colony, cols: readonly Colony[]): string {
  if (c.originPatron) return c.originPatron;
  if (c.patron === "Independent" && c.liegeId && c.liegeId !== c.id) {
    const l = cols.find((x) => x.id === c.liegeId);
    if (l?.originPatron) return l.originPatron;
  }
  return c.patron;
}

export function colonyFlagInput(G: Pick<GameState, "seed" | "colonies">, c: Colony): FlagInput {
  const cols = G.colonies;
  const indep = c.patron === "Independent";
  const liegeCol = indep && c.liegeId ? cols.find((x) => x.id === c.liegeId) ?? c : null;
  return {
    seed: G.seed, id: c.id, origin: originOf(c, cols), patron: c.patron,
    ideology: c.ideology[0] ?? "", specialty: c.specialty, body: c.body,
    liege: liegeCol ? { id: liegeCol.id, origin: originOf(liegeCol, cols), ideology: liegeCol.ideology[0] ?? "" } : null,
    isLiege: !!liegeCol && liegeCol.id === c.id,
  };
}

export function flagForColony(G: Pick<GameState, "seed" | "colonies">, c: Colony): FlagDesign {
  return colonyFlag(colonyFlagInput(G, c));
}
export function flagForEarth(blocName: string): FlagDesign { return blocFlag(blocName); }
