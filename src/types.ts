export type Alliance = "West" | "East" | "Neutral";
export type Body = "Moon" | "Mars";

/** Logistics reach theater (0.7.1). */
export type LineReach = "earth" | "moon" | "mars";

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
  /** @deprecated 0.8.3 — use trojanSend reverse-logistics instead. */
  trojanExport?: boolean;
  /**
   * Send Subversion / Trojan occupying this line as reverse logistics (0.8.3).
   * Does not grant the target a trade node; sets permanent subversionMark on target.
   */
  trojanSend?: { targetId: string; targetName: string } | null;
}

export interface OxygenSupplier { id: string; name: string; body: Body; surplus: number }
export interface OxygenCrisis { since: number; shortfall: number; suppliers: OxygenSupplier[] }

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
}
