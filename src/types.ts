export type Alliance = "West" | "East" | "Neutral";
export type Body = "Moon" | "Mars" | "Belt";

/** Logistics reach theater (0.7.1). */
export type LineReach = "earth" | "moon" | "mars" | "belt";

export type NodeType =
  | "Resources" | "Infrastructure" | "Water" | "Oxygen" | "Food" | "Energy"
  | "Population" | "Culture" | "Ideology" | "Money" | "Logistics"
  | "Science" | "Production" | "Military" | "Stability" | "Subversion"
  | "Terraforming" | "Thrust" | "Projects";

export interface ExcessSlot {
  node: NodeType;
  claimedBy: string | null;
}

export interface EarthBloc {
  name: string;
  /** Mutable (0.7.1 social development may soften/flip). */
  alliance: Alliance;
  tech: number;
  cap: number;
  /** Excess list IS the slot list; grows when every entry is claimed. */
  excess: ExcessSlot[];
  colonies: number;
  /** Stable nation color hex (0.8.0). */
  nationColor?: string;
}

export interface ImportRoute {
  sourceKind: "earth" | "colony";
  sourceId: string;
  sourceName: string;
  node: NodeType;
  slotIndex?: number;
  /** @deprecated 0.8.3 — Trojans no longer ride inside import payloads. */
  trojan?: boolean;
  /** Tagged when node is Requires or missing basal (0.8.0). */
  vital?: boolean;
  /** Soft blackmail flag (0.8.0). */
  threatened?: boolean;
  /** Probe trade: temporary Earth import cancelled next turn to reroll excess (0.8.2). */
  earthCycle?: boolean;
  /**
   * Bilateral counter on the same colony↔colony trade (0.8.3).
   * Importer receives `node`; partner may counter-request `counterNode` if consented.
   */
  counterNode?: NodeType | null;
  counterConsent?: boolean;
}

/** Outbound leg on a two-way logistics line (0.7.1). */
export interface ExportRoute {
  colonyId: string;
  colonyName: string;
  node: NodeType;
  importerLineId: string;
  /** @deprecated 0.8.3 */
  trojan?: boolean;
  vital?: boolean;
  threatened?: boolean;
  /** Node received via consented bilateral counter on this link (0.8.3). */
  inboundNode?: NodeType | null;
}

export interface LogisticsLine {
  id: string;
  name: string;
  kind: "base" | "import" | "develop" | "specialty" | "borrowed";
  sourceLabel?: string;
  earthClaim?: { blocName: string; slotIndex: number };
  colonySourceId?: string;
  /** Import leg (null = import slot free). */
  route: ImportRoute | null;
  /**
   * Export leg (0.7.1): one open line carries 1 import + 1 export simultaneously.
   * null/undefined = export slot free.
   */
  exportRoute?: ExportRoute | null;
  /**
   * Reach theater derived from origin:
   * - earth: Earth↔Moon (and Earth→Mars if line is on Mars)
   * - moon: Earth↔Moon + Moon↔Mars
   * - mars: Moon↔Mars + Mars-local (never Earth↔Moon)
   */
  reach?: LineReach;
  /** Colony id borrowing this line; null/undefined = not lent. Lent lines lock both slots for owner. */
  lentTo?: string | null;
  /** Borrower-side temporary line that uses a lender's lent capacity. */
  borrowedFrom?: { colonyId: string; lineId: string } | null;
  /** 0.19.0 relay: this Earth-import line also delivers its good onward to one colony. */
  relayTo?: { colonyId: string; lineId: string; colonyName: string } | null;
  /** 0.19.0 relay: receiving side (kind "borrowed", route sourced from the relaying colony). */
  relay?: boolean;
  /** 0.20.0 Thrust reach: this line can reach the asteroid belt (owner — or lender — has enough Thrust). Refreshed each action. */
  beltOk?: boolean;
  /** @deprecated 0.8.3 — use trojanSend reverse-logistics instead. */
  trojanExport?: boolean;
  /**
   * Send Subversion / Trojan occupying this line as reverse logistics (0.8.3).
   * Does not grant the target a trade node; sets permanent subversionMark on target.
   */
  trojanSend?: { targetId: string; targetName: string } | null;
}

export interface OxygenSupplier { id: string; name: string; body: Body; surplus: number }
export interface OxygenCrisis {
  since: number; shortfall: number; suppliers: OxygenSupplier[];
  /** 0.19.0 oxygen wars: what the colony did (plead / threat / seize) and who refused. */
  actions?: string[]; refusedBy?: string[];
}
export interface CasusBelli { targetId: string; targetName: string; until: number; reason: string }
export interface FervorEvent { until: number; amount: number; why: string }
export interface NomadCamp { since: number; originId: string; originName: string; rejectedBy: string[]; resource: "Food" | "Water"; repels: number; lastRaid?: number }

export interface Colony {
  id: string;
  name: string;
  /** Earth bloc name, or `"Independent"`. */
  patron: string;
  /**
   * Independent network root colony id (self for revolter / Independent founder).
   * `null` for Earth subjects.
   */
  liegeId: string | null;
  /** Subject fervor ledger (±1 terms, recomputed). Independents hold 0. */
  fervor: number;
  /**
   * Permanent subversion mark from Trojan *send* against this colony (0.9.1).
   * Importing or developing Subversion as a tool does NOT set this on the importer.
   */
  subversionMark?: boolean;
  /**
   * 0.15.0 flag lineage: founding Earth bloc (Independent-founded colonies inherit their
   * liege's origin). Presentation only — never read by rules.
   */
  originPatron?: string;
  /** Turn this colony was founded (for min-age independence gate). */
  foundedTurn?: number;
  /** 0.21.0 daughter colonies: the parent colony id (lineage). */
  parentId?: string;
  /** 0.21.0 how it was founded: "pressure" | "wave" | "first" | "daughter" | "tech" … */
  foundTags?: string[];
  /** 0.21.0 last turn this colony seeded a daughter. */
  lastDaughterTurn?: number;
  /** Lend attempts this turn (max 1 — 0.8.0). */
  lendAttemptsThisTurn?: number;
  /** Optional display name for solar bloc when this colony is liege (0.8.0). */
  solarBlocName?: string;
  body: Body;
  bodyMod: number;
  culture: string[];
  ideology: string[];
  /** Times Ideology was gained via develop (not import). */
  ideologyDevelopCount: number;
  /** Ideology tags gained via import routes (permanent). */
  ideologyImported: string[];
  specialty: NodeType;
  requires: NodeType;
  developed: Record<NodeType, number>;
  logisticsLines: LogisticsLine[];
  nextLineId: number;
  acted: boolean;
  /** L4 survival clocks (food/water; oxygen if body not livable). */
  foodClock?: number;
  waterClock?: number;
  oxygenClock?: number;
  /**
   * 0.17.0 hook (no AI yet): set while the Oxygen clock is running. `suppliers` = colonies with spare
   * Oxygen that are not sending any to this colony — future casus belli / blackmail targets.
   */
  oxygenCrisis?: OxygenCrisis | null;
  /** 0.19.0: justified wars this colony (and its nation/allies) may wage without the usual penalties. */
  casusBelli?: CasusBelli[];
  /** 0.19.0: refused Oxygen while others died — marked until this turn. */
  hoarderUntil?: number;
  /** 0.19.0: timed fervor (hoarder trade partner, accepted refugees). */
  fervorEvents?: FervorEvent[];
  /** 0.19.0: this colony is a nomad camp (weak, bloc-less, raids those who refused it). */
  nomad?: NomadCamp | null;
  /** 0.20.0: belt colony whose (belt) specialty yields 2 instead of 1 (asteroid mining). */
  beltRich?: boolean;
  /** L4: Population stress when refugees flee with no Population extra. */
  populationStress?: number;
  /** 0.9.4 last refugee emission turn (per-colony cooldown). */
  lastRefugeeTurn?: number;
  /** L5 projects. */
  projectsDone?: string[];
  projectActive?: string;
  projectProgress?: number;
  /** L7 proxy agitation (decays 1/turn). */
  proxyAgitation?: number;
  /** L4: specialty Military invasion token burned (until redeveloped). */
  militaryTokenBurned?: boolean;
}

export interface LogEntry {
  turn: number;
  msg: string;
  imp: boolean;
}

export interface FoundingAnnouncement {
  patron: string;
  colonyName: string;
  body: Body;
  turn: number;
}

export type GameMode = "random" | "realistic";

export interface IndependentGroupSnap {
  liegeId: string;
  liegeName: string;
  members: string[];
  colonyCount: number;
  totalRp: number;
  /** Alias for totalRp — nation regional power (0.8.0). */
  nationRp: number;
  nationColor: string;
  solarBlocName?: string;
}

export interface GameState {
  turn: number;
  seed: number;
  /** v0.5.1+: always "random"; "realistic" specialty pools come later. */
  gameMode: GameMode;
  blocs: EarthBloc[];
  colonies: Colony[];
  bodyTF: Record<Body, number>;
  log: LogEntry[];
  nameSerial: Record<string, number>;
  nextColonyId: number;
  pendingFoundings: FoundingAnnouncement[];
  /** 0.20.0 Earth blocs that already got the first-belt-colony milestone. */
  beltMilestones?: string[];
  turnAnnouncements: string[];
  /** Hysteresis counters for alliance softening/flip (bloc name → streak). */
  alliancePressure?: Record<string, number>;
  /** Turn of last successful found (Earth or Independent) — founding cooldown (0.8.0). */
  lastFoundTurn?: number;
  /** Turn of last solar-bloc / relation founding (0.8.0). */
  lastSolarBlocTurn?: number;
  /** Editable independence fervor threshold (synced with fervorParams.threshold). */
  independenceThreshold?: number;
  /** Optional fervor ledger weight/gate overrides (0.9.1). Merged onto defaults in l3. */
  fervorParams?: Record<string, number>;
  /** Optional solar-bloc / diplomacy timing overrides (0.9.3). Merged onto defaults in nation. */
  solarBlocParams?: Record<string, number>;
  /** L4 Earth threat track (pair key → 0..3). */
  threatTrack?: Record<string, number>;
  /** L4 last refugee Independent founding turn (cooldown). */
  lastRefugeeFoundTurn?: number;
  /** 0.9.4+ lobby rule flags (see rules.ts). */
  rules?: Record<string, number | boolean>;
  /** L7 last Earth overturn turn. */
  lastOverturnTurn?: number;
  /** 0.21.0 colonization pressure meter per Earth bloc (rule `colonizationWaves`). */
  pressure?: Record<string, number>;
  /** 0.21.0 active first-founding waves per bloc (rule `firstFoundingWave`). */
  waves?: Record<string, ColonizationWave>;
  /** 0.21.0 colonies ever founded per Earth bloc (pressure threshold growth; revolutions don't reset it). */
  blocFounded?: Record<string, number>;
  /** 0.21.0 internal: colony ids already counted in blocFounded. */
  __seenColonies?: Set<string>;
  /** 0.21.0 turn of the last daughter colony (one per turn system-wide). */
  daughterTurn?: number;
  /** 0.21.0 foundings per bloc this turn (per-bloc per-turn cap). */
  foundThisTurn?: Record<string, number>;
  /** 0.21.0 deterministic event record (rule `eventLog`) — source for History, 0.21.1 Lineage + cluster replay. */
  events?: GameEvent[];
  /** 0.21.0 per-turn relation snapshots (compact) for the 0.21.1 replayable cluster graph. */
  timeline?: TurnSnapshot[];
  /** 0.21.0 internal: log index already classified into events. */
  __eventLogIdx?: number;
  /** 0.21.0 internal: explicit identity events this turn ("turn|id|kind"). */
  __identityMarks?: Set<string>;
  /** 0.21.0 internal: colonies in a war / seizure this turn (snapshot flag). */
  __warThisTurn?: Set<string>;
}

/** 0.21.0 first-founding wave: cheap / fast founding on `body` until `until`. */
export interface ColonizationWave { body: Body; start: number; until: number; strength: number; founded: number; trigger: string }

export type GameEventType =
  | "found" | "lost" | "war" | "seize" | "o2" | "raid" | "camp" | "allianceShift" | "patronChange"
  | "independence" | "revolution" | "annex" | "ideology" | "culture" | "wave" | "milestone";
/**
 * 0.21.0 event record. Deterministic (no RNG, derived from sim state + stable log markers).
 * `colonies` = colony ids involved (actor first), `blocs` = Earth blocs involved.
 * `parents` (ideology / culture blends) lets 0.21.1 draw the Lineage tree; `parentColony` links daughters.
 */
export interface GameEvent {
  seq: number; turn: number; type: GameEventType;
  colonies: string[]; blocs: string[];
  /** colony names at the time (aligned with `colonies`). */
  names: string[];
  tags?: string[];
  before?: Record<string, string | number | string[] | null>;
  after?: Record<string, string | number | string[] | null>;
  parents?: string[];
  parentColony?: string;
  /** Short template text (no AI) — History tab sentence source. */
  text: string;
}
/** 0.21.0 compact per-turn relation snapshot (end of turn). */
export interface TurnSnapshot {
  turn: number;
  alliances: Record<string, string>;
  cols: { id: string; name: string; patron: string; liege: string | null; body: Body; level: number; ideology: string[]; culture: string[]; trade: string[]; war: boolean }[];
}
