/**
 * 0.9.4+ generic lobby rule flags / params (Rules tab). Stored on G.rules.
 * Each rule: default (shipped) + legacy (pre-0.9.4 behaviour) so old feel stays testable.
 */
import type { GameState } from "./types.js";

export interface RuleDef {
  id: string;
  label: string;
  group: string;
  kind: "number" | "bool";
  def: number | boolean;
  legacy: number | boolean;
  min?: number; max?: number; step?: number;
  help: string;
}

export const RULE_DEFS: RuleDef[] = [
  { id: "foundCooldownBase", label: "Founding cooldown (base turns)", group: "Growth", kind: "number", def: 2, legacy: 0, min: 0, max: 10, step: 1,
    help: "Minimum turns between any two colony foundings." },
  { id: "foundCooldownPerColony", label: "Extra cooldown per existing colony", group: "Growth", kind: "number", def: 0.4, legacy: 0, min: 0, max: 2, step: 0.05,
    help: "Cooldown grows with colony count so expansion slows later." },
  { id: "refugeeClockTrip", label: "Survival clock trip (turns lacking)", group: "Refugees", kind: "number", def: 6, legacy: 3, min: 1, max: 20, step: 1,
    help: "Turns a need must be unmet before refugees flee." },
  { id: "refugeeColonyCooldown", label: "Refugee cooldown per colony", group: "Refugees", kind: "number", def: 20, legacy: 0, min: 0, max: 40, step: 1,
    help: "After a refugee event, the same colony can't emit again for this many turns." },
  { id: "refugeeClockRecovery", label: "Clocks recover when need met", group: "Refugees", kind: "bool", def: true, legacy: false,
    help: "Survival clocks tick back down on turns the need is covered." },
  { id: "survivalNeedsPopulation", label: "Survival clocks need a native Population (0.16.0)", group: "Refugees", kind: "bool", def: true, legacy: false,
    help: "On (Tiago's rule): the Food / Water / Oxygen clock ticks only while the colony has its own (developed or specialty) Population and lacks that resource (not owned, not imported). Strain alone never ticks a clock; imported Population needs nothing. Off = 0.9.x–0.15.x: any strain + lacking the resource ticked the clock, Population or not." },
  { id: "survivalScaledCover", label: "Scaled survival cover + Tiago's clocks (0.17.0)", group: "Refugees", kind: "bool", def: true, legacy: false,
    help: "On (Tiago, 0.17.0): N developed Population needs N Food, N Water and N Oxygen (owned + imported); a shortfall ticks that resource's clock. A Population specialty is one extra Population that needs nothing. Clocks give the turns of grace below (Food 3, Water 2, Oxygen 1) and fire on the next short tick: Food/Water → refugees, Oxygen → the uncovered Population dies. Stability halves the tick rate only if ≥ half its prerequisites are owned or imported. No per-colony refugee cooldown (the trip and cooldown above are ignored). Off = 0.16.0 clocks." },
  { id: "clockTripFood", label: "Food clock (turns of grace)", group: "Refugees", kind: "number", def: 3, legacy: 3, min: 1, max: 12, step: 1,
    help: "0.17.0: turns a Food shortfall can last; the next short tick sends refugees." },
  { id: "clockTripWater", label: "Water clock (turns of grace)", group: "Refugees", kind: "number", def: 2, legacy: 2, min: 1, max: 12, step: 1,
    help: "0.17.0: turns a Water shortfall can last; the next short tick sends refugees." },
  { id: "clockTripOxygen", label: "Oxygen clock (turns of grace)", group: "Refugees", kind: "number", def: 1, legacy: 1, min: 1, max: 12, step: 1,
    help: "0.17.0: turns an Oxygen shortfall can last; the next short tick kills the uncovered Population." },
  { id: "l5Thrust", label: "L5 Thrust: Thrust gives Mars reach without lunar basis", group: "L5 Projects / Thrust", kind: "bool", def: true, legacy: false,
    help: "Any same-nation colony with Thrust extras (or an Orbital Shipyard) opens Mars founding." },
  { id: "l5Projects", label: "L5 Projects (rule-changing megaprojects)", group: "L5 Projects / Thrust", kind: "bool", def: true, legacy: false,
    help: "Colonies with Projects extras (or Production+Science) build Shipyard / Terraforming / Supply Chain." },
  { id: "projectsMinTurn", label: "Projects unlock turn", group: "L5 Projects / Thrust", kind: "number", def: 30, legacy: 30, min: 1, max: 200, step: 1,
    help: "No project progress before this turn." },
  { id: "projectCost", label: "Project cost (progress points)", group: "L5 Projects / Thrust", kind: "number", def: 20, legacy: 20, min: 1, max: 100, step: 1,
    help: "Progress/turn = 2×Projects extras +1 if Production & Science." },
  { id: "projectFervor", label: "Supply Chain fervor for subjects", group: "L5 Projects / Thrust", kind: "number", def: 2, legacy: 0, min: 0, max: 10, step: 1,
    help: "Self-reliance pushes subjects toward independence (solar hegemon arc)." },
  { id: "l6Presentation", label: "L6 Solar Realist presentation (flags + solar map)", group: "L6 Presentation", kind: "bool", def: true, legacy: false,
    help: "Procedural colony flags and an Earth–Moon–Mars map panel." },
  { id: "l7Proxy", label: "L7 Earth proxy wars (threat ≥ N agitates rival colonies)", group: "L7 Geopolitics", kind: "bool", def: true, legacy: false,
    help: "At West↔East threat ≥ N, each camp adds decaying fervor to one rival-camp colony per turn." },
  { id: "l7ProxyThreat", label: "Proxy war threat level", group: "L7 Geopolitics", kind: "number", def: 1, legacy: 1, min: 1, max: 3, step: 1,
    help: "Earth threat track level (0–3) that starts proxy agitation." },
  { id: "l7Overturn", label: "L7 Solar hegemons overturn Earth patrons", group: "L7 Geopolitics", kind: "bool", def: true, legacy: false,
    help: "Strongest Independent liege absorbs an Earth nation's remaining colonies when it out-powers it." },
  { id: "l7OverturnMinTurn", label: "Overturn earliest turn", group: "L7 Geopolitics", kind: "number", def: 90, legacy: 90, min: 1, max: 300, step: 1,
    help: "No overturns before this turn (max one per 15 turns)." },
  { id: "l7OverturnRatio", label: "Overturn power ratio (hegemon RP ÷ Earth RP)", group: "L7 Geopolitics", kind: "number", def: 3, legacy: 3, min: 1, max: 5, step: 0.25,
    help: "How much stronger the hegemon must be." },
];

export type Rules = Record<string, number | boolean>;

export function defaultRules(): Rules {
  return Object.fromEntries(RULE_DEFS.map((r) => [r.id, r.def]));
}
export function legacyRules(): Rules {
  return Object.fromEntries(RULE_DEFS.map((r) => [r.id, r.legacy]));
}
export function applyRules(G: GameState, patch?: Partial<Rules>): void {
  G.rules = { ...defaultRules(), ...(G.rules || {}), ...(patch || {}) } as Rules;
}
export function ruleNum(G: GameState, id: string): number {
  const v = G.rules?.[id];
  if (typeof v === "number") return v;
  const d = RULE_DEFS.find((r) => r.id === id)!.def;
  return typeof d === "number" ? d : Number(d);
}
export function ruleOn(G: GameState, id: string): boolean {
  const v = G.rules?.[id];
  if (typeof v === "boolean") return v;
  return !!RULE_DEFS.find((r) => r.id === id)?.def;
}
