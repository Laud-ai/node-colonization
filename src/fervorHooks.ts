/** L5/L7 fervor ledger terms (kept dependency-free to avoid import cycles). */
import type { Colony, GameState } from "./types.js";
import { ruleNum, ruleOn } from "./rules.js";

export function extraFervor(G: GameState, c: Colony): number {
  if (!G.rules) return 0;
  let s = 0;
  if (ruleOn(G, "l5Projects") && c.projectsDone?.includes("Earth-Independent Supply Chain")) s += ruleNum(G, "projectFervor");
  if (ruleOn(G, "l7Proxy")) s += c.proxyAgitation || 0;
  return s;
}
