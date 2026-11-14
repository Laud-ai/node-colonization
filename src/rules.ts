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
  { id: "aiTurnOrderRp", label: "Turn order: highest RP first (0.17.1)", group: "AI", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): colonies act from highest to lowest RP (ties: hungrier first, then name). Off = hungriest first (need score), RP only as a tie-break — which in play looked like lowest RP first." },
  { id: "aiSpreadDevelop", label: "AI spreads develops to smaller colonies (0.17.1)", group: "AI", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): a colony at least `aiSpreadGap` levels above a friendly (same nation, or same Earth alliance) colony that has not acted yet leaves it the source of their shared Requires, and first feeds a smaller friend's Requires from its own surplus. Off = every colony takes the best source for itself." },
  { id: "aiSpreadGap", label: "Spread: level gap", group: "AI", kind: "number", def: 3, legacy: 3, min: 1, max: 10, step: 1,
    help: "Diminishing returns: a colony yields / feeds only to friends this many levels below it." },
  { id: "aiActiveEarth", label: "AI works Earth instead of passing (0.17.1)", group: "AI", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): before passing, a colony imports Logistics (Earth first) for a new line, moves a non-vital route onto an unclaimed slot of its own or an allied Earth bloc (helps fill it so it unlocks a new excess), or feeds an allied colony's Requires. Passes only when none is possible." },
  { id: "bcNeutral", label: "British Commonwealth starts Neutral (0.18.0)", group: "Earth & Mars", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): the British Commonwealth starts Neutral instead of West; it can still drift through the usual social/trade alliance shifts." },
  { id: "marsFoundingMoonAlly", label: "Mars founding needs a friendly Moon colony (0.18.0)", group: "Earth & Mars", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): a nation may seed Mars once any Moon colony of its own nation — or of a same-alliance (West/East) nation — exists. Neutral blocs and Independents count only their own nation. Replaces the strong-lunar-basis / lunar-ally-feed gate; Thrust and the Orbital Shipyard no longer open Mars (the L5 Thrust rule is ignored)." },
  { id: "marsMoonOnlyImports", label: "Mars imports only from Moon (and Mars) colonies (0.18.0)", group: "Earth & Mars", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): Mars colonies never trade with Earth directly (no Earth imports, cycles, or Earth Logistics) — everything comes from Moon colonies, including on Moon lines lent to them. Mars↔Mars trade unchanged." },
  { id: "aiLendAllies", label: "AI lends to allies, refuses opponents, no hoarding (0.18.0)", group: "AI", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): a colony always lends a line to an ally (same nation / same West-East alliance) that asks and always refuses an opponent (West↔East). A bigger ally with no free line lends one that is only cycling Earth, or a non-critical one, to a smaller ally that has no line for a Requires/survival need. Replaces 0.17.1's no-borrowing-from-smaller and line-recall." },
  { id: "aiLogisticsLoop", label: "AI Logistics loop: cycle Earth → Logistics → fill Earth (0.18.0)", group: "AI", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): unless it can develop or get a critical (Requires/survival) resource, a colony imports Earth Logistics when a slot is there (+1 line, kept), otherwise keeps cycling Earth nodes, and with spare lines fills its own/allied Earth blocs' slots (bloc closest to unlocking first) so they unlock more excess." },
  { id: "relayLines", label: "Relay lines: Earth imports passed on (0.19.0)", group: "Crises & Relays", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): a line importing only from Earth can also deliver that good to ONE other colony (lending/alliance/refusal rules apply). The only way Earth goods reach Mars (via a Moon relay)." },
  { id: "oxygenWars", label: "Oxygen wars: plead → threaten → seize (0.19.0)", group: "Crises & Relays", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): in its Oxygen-crisis warning turn a colony pleads with colonies that have spare O₂ (allies always accept; others accept at affinity ≥ plea threshold for a price: one developed node, else a step toward their bloc). A refusal gives it a casus belli (its nation and allies may invade the refuser without threat penalties). Still short: a desperate seizure with an attack bonus (win = take an Oxygen node, loss = the uncovered Population dies). Refusers are marked hoarders when Population dies; their trade partners gain fervor." },
  { id: "o2PleaAffinity", label: "O₂ plea: min affinity (non-allies)", group: "Crises & Relays", kind: "number", def: 1, legacy: 1, min: -3, max: 5, step: 1, help: "Non-allied suppliers accept a plea (for a price) at this social affinity or more; West↔East always refuse." },
  { id: "o2SeizeBonus", label: "O₂ seizure attack bonus (RP)", group: "Crises & Relays", kind: "number", def: 2, legacy: 2, min: 0, max: 10, step: 1, help: "Desperate seizure: attacker RP + bonus must beat defender RP." },
  { id: "o2CasusBelliTurns", label: "Casus belli duration (turns)", group: "Crises & Relays", kind: "number", def: 15, legacy: 15, min: 1, max: 60, step: 1, help: "How long a refusal justifies war." },
  { id: "o2JoinChance", label: "Justified war: AI join chance / turn", group: "Crises & Relays", kind: "number", def: 0.25, legacy: 0.25, min: 0, max: 1, step: 0.05, help: "Chance an armed colony (Military token) of the wronged nation/allies invades the refuser each turn (normal opportunistic invasions are 8%)." },
  { id: "o2HoarderTurns", label: "Hoarder mark duration (turns)", group: "Crises & Relays", kind: "number", def: 10, legacy: 10, min: 1, max: 60, step: 1, help: "Mark length; also how long partners' extra fervor lasts." },
  { id: "o2HoarderFervor", label: "Hoarder: fervor in trade partners", group: "Crises & Relays", kind: "number", def: 2, legacy: 2, min: 0, max: 10, step: 1, help: "Extra fervor in each colony trading with a marked hoarder." },
  { id: "nomadCamps", label: "Nomad refugees & camps (0.19.0)", group: "Crises & Relays", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): Food/Water refugees score colonies (same body +3, spare of the lacking resource ×2 (max 3), RP/5, shared ideology +2) and try the best first. A host with spare that is friendly (or affinity ≥ 1) accepts (+1 Population, timed fervor); a rival with Subversion arms them (Trojan back home); others refuse. All refuse → a nomad camp settles: it raids a colony that refused it every few turns (stopped by defense), is absorbed by the defender after too many failed raids, and becomes an Independent founder if it survives long enough." },
  { id: "refugeeAcceptFervor", label: "Accepting refugees: fervor (10 turns)", group: "Crises & Relays", kind: "number", def: 1, legacy: 1, min: 0, max: 5, step: 1, help: "Extra fervor in a host that takes refugees in, for 10 turns." },
  { id: "nomadRaidEvery", label: "Camp raids every N turns", group: "Crises & Relays", kind: "number", def: 3, legacy: 3, min: 1, max: 20, step: 1, help: "Raid: attack 1 + age/10 vs defense 1 + 2 (Military token) + 1 (Stability)." },
  { id: "nomadCampTurns", label: "Camp → Independent founder after (turns)", group: "Crises & Relays", kind: "number", def: 20, legacy: 20, min: 5, max: 80, step: 1, help: "A camp that survives this long becomes a normal Independent colony (can found)." },
  { id: "nomadMaxRepels", label: "Camp absorbed after failed raids", group: "Crises & Relays", kind: "number", def: 3, legacy: 3, min: 1, max: 10, step: 1, help: "After this many repelled raids the defender absorbs the camp." },
  { id: "nomadMaxCamps", label: "Max nomad camps at once", group: "Crises & Relays", kind: "number", def: 4, legacy: 4, min: 0, max: 20, step: 1, help: "Beyond this, rejected refugees are stranded as before." },
  { id: "thinAirOxygen", label: "Thin air: longer Oxygen clock on part-terraformed bodies (0.19.0)", group: "Crises & Relays", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): below livable TF, the Oxygen clock gives 2 turns of grace from TF ≥ thinAirTf2 and 3 from TF ≥ thinAirTf3 (instead of 1)." },
  { id: "thinAirTf2", label: "Thin air: TF for 2-turn O₂ clock", group: "Crises & Relays", kind: "number", def: 1, legacy: 1, min: 1, max: 9, step: 1, help: "TF at/above this (and below livable 10) → Oxygen clock 2." },
  { id: "thinAirTf3", label: "Thin air: TF for 3-turn O₂ clock", group: "Crises & Relays", kind: "number", def: 5, legacy: 5, min: 1, max: 9, step: 1, help: "TF at/above this (and below livable 10) → Oxygen clock 3." },
  { id: "beltColonies", label: "Asteroid belt: Thrust reach & belt colonies (0.20.0)", group: "Asteroid Belt", kind: "bool", def: true, legacy: false,
    help: "On (Tiago): a line reaches the belt only if its colony (or, for a lent/relayed line, the lending colony) has Thrust ≥ the reach threshold. Founding in the belt needs a Mars colony of the founder's nation or a same-alliance nation with that Thrust reach (Neutral/Independent: own nation). Belt colonies import ONLY from Mars (own Thrust lines, lent Mars lines, Mars relays); never Earth/Moon, never Belt↔Belt. Hostile: no atmosphere, never livable, Oxygen clock always 1 turn (thin air never applies), Terraforming has no effect there." },
  { id: "beltThrustReach", label: "Belt: Thrust needed for a line to reach the belt", group: "Asteroid Belt", kind: "number", def: 1, legacy: 1, min: 1, max: 6, step: 1, help: "Thrust = specialty/developed/imported Thrust (+1 with the Orbital Shipyard project) (+1 from an allied belt depot)." },
  { id: "beltRichSpecialty", label: "Belt: asteroid-mining specialties (×2)", group: "Asteroid Belt", kind: "bool", def: true, legacy: false,
    help: "On: belt colonies roll their specialty from Thrust / Production / Resources / Logistics and their specialty counts 2 instead of 1 (more to export to Mars). No new resources." },
  { id: "beltDepot", label: "Belt: Thrust refuel depots", group: "Asteroid Belt", kind: "bool", def: true, legacy: false,
    help: "On: a belt colony with Thrust ≥ 1 is a refuel depot — every colony of its nation or same alliance gets +1 Thrust toward belt reach (not stacking)." },
  { id: "beltMilestone", label: "Belt milestone: first belt colony boosts its Earth bloc", group: "Asteroid Belt", kind: "bool", def: true, legacy: false,
    help: "On: the first belt colony of an Earth bloc gives that bloc + milestone tech (pays future founding tax)." },
  { id: "beltMilestoneTech", label: "Belt milestone: bloc tech bonus", group: "Asteroid Belt", kind: "number", def: 2, legacy: 2, min: 0, max: 10, step: 1, help: "One-time tech for the bloc's first belt colony." },
  // 0.21.0 Living Colony (Tiago): colonization waves + event log / History
  { id: "colonizationWaves", label: "Colonization pressure meter per Earth bloc (0.21.0)", group: "Colonization", kind: "bool", def: true, legacy: false,
    help: "Each Earth bloc fills a meter every turn: base + filled Earth node slots + rival colonies on bodies where it has none (×boost while it has no colony). Crossing the threshold founds a colony (bypassing the tech cap) and resets the meter. Off = 0.20.0 founding (tech cap + cooldown only)." },
  { id: "pressureBase", label: "Pressure: base per turn", group: "Colonization", kind: "number", def: 0.3, legacy: 0.3, min: 0, max: 5, step: 0.1, help: "Meter gain every turn." },
  { id: "pressurePerSlot", label: "Pressure: per filled Earth node slot", group: "Colonization", kind: "number", def: 0.15, legacy: 0.15, min: 0, max: 2, step: 0.05, help: "Claimed excess slots of the bloc's Earth economy." },
  { id: "pressurePerRival", label: "Pressure: per rival colony on a body where the bloc has none", group: "Colonization", kind: "number", def: 0.05, legacy: 0.05, min: 0, max: 2, step: 0.05, help: "Other blocs' colonies on bodies the bloc is missing from (reachable bodies only)." },
  { id: "pressureZeroBoost", label: "Pressure: ×boost while the bloc has no colony", group: "Colonization", kind: "number", def: 2, legacy: 2, min: 1, max: 5, step: 0.25, help: "Blocs with zero colonies build pressure faster." },
  { id: "pressureThreshold", label: "Pressure: threshold that triggers a founding", group: "Colonization", kind: "number", def: 30, legacy: 30, min: 5, max: 200, step: 1, help: "Crossing it founds a colony and resets the meter. Later colonies still wait for the founding cooldown; a bloc's first colony does not (one first colony per turn)." },
  { id: "pressureGrowth", label: "Pressure: threshold +× per colony the bloc already has", group: "Colonization", kind: "number", def: 2, legacy: 2, min: 0, max: 5, step: 0.1, help: "Threshold × (1 + this × own colonies): big blocs need more pressure for each further colony (keeps totals near 0.20.0)." },
  { id: "firstFoundingWave", label: "First-founding wave (0.21.0)", group: "Colonization", kind: "bool", def: true, legacy: false,
    help: "A bloc's first colony on a body is near-free (no founding tax), then opens a short window of cheap (no tax) and fast (bypasses the cooldown, lower threshold, faster meter) founding on that body, stronger the more established rivals already are there." },
  { id: "waveTurns", label: "Wave: window length (turns)", group: "Colonization", kind: "number", def: 5, legacy: 5, min: 1, max: 20, step: 1, help: "Base length of the wave window." },
  { id: "waveRivalScale", label: "Wave: strength per rival colony on the body", group: "Colonization", kind: "number", def: 0.05, legacy: 0.05, min: 0, max: 1, step: 0.01, help: "Strength = this × rival colonies on the body (max 1). Meter gain ×(1+strength); window +2 turns per full 0.5." },
  { id: "waveMaxColonies", label: "Wave: max extra colonies per wave", group: "Colonization", kind: "number", def: 1, legacy: 1, min: 0, max: 5, step: 1, help: "Cheap / fast foundings a single wave can add (the first colony itself not counted)." },
  { id: "waveThresholdFactor", label: "Wave: threshold factor during the window", group: "Colonization", kind: "number", def: 0.5, legacy: 0.5, min: 0.1, max: 1, step: 0.05, help: "During a wave the bloc founds on the wave body (tax-free, no shared cooldown) once its meter reaches this fraction of the base threshold (no per-colony growth). The meter also gets a push of strength × that amount ÷ window length per turn." },
  { id: "daughterColonies", label: "Daughter colonies (0.21.0)", group: "Colonization", kind: "bool", def: true, legacy: false,
    help: "A colony at or above the level below with a free line (or a non-vital import it drops) spends that line to seed a daughter on its own body or one step out (Moon→Mars, Mars→belt with belt reach). Its first daughter on a new body starts a first-founding wave. Daughters inherit culture and ideology. Not while the parent runs a survival clock or an O₂ crisis; one daughter per turn system-wide (own throttle, not the founding cooldown)." },
  { id: "daughterMinLevel", label: "Daughter: minimum parent level", group: "Colonization", kind: "number", def: 5, legacy: 5, min: 1, max: 20, step: 1, help: "Parent colony level needed to seed." },
  { id: "daughterPressure", label: "Daughter: share of the bloc's pressure threshold needed", group: "Colonization", kind: "number", def: 0.5, legacy: 0.5, min: 0, max: 2, step: 0.05, help: "A daughter is one way a bloc releases colonization pressure: it needs the bloc meter at this share of the current threshold and empties it." },
  { id: "daughterCooldown", label: "Daughter: turns between daughters of one parent", group: "Colonization", kind: "number", def: 25, legacy: 25, min: 1, max: 60, step: 1, help: "Per parent colony." },
  { id: "foundPerBlocPerTurn", label: "Brake: max foundings per bloc per turn", group: "Colonization", kind: "number", def: 1, legacy: 1, min: 1, max: 5, step: 1, help: "Waves also end when the founder can't supply its new colonies (no sibling with basal/Money surplus once it has 2+)." },
  { id: "eventLog", label: "Event log + History tab (0.21.0)", group: "History", kind: "bool", def: true, legacy: false,
    help: "Deterministic record of foundings (wave / daughter tags), wars, seizures, oxygen wars, bloc shifts, revolutions / independence, ideology and culture changes (with blend parents), nomad camps, plus a per-turn relation snapshot. Feeds the colony History tab (and 0.21.1 Lineage / cluster replay). No effect on the simulation." },
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
