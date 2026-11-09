/**
 * Named SolarBlocParams variants for the 0.9.3 diplomacy / solar-bloc sweep + setup tab.
 * Do not hardcode playtest colony names — variants are pure param sets.
 */
import type { SolarBlocParams } from "./nation.js";
import {
  DEFAULT_SOLAR_BLOC_PARAMS,
  LEGACY_SOLAR_BLOC_PARAMS,
} from "./nation.js";

export interface SolarBlocVariant {
  id: string;
  label: string;
  /** Short human-readable summary for the pre-sim setup menu. */
  summary: string;
  params: SolarBlocParams;
}

function withP(partial: Partial<SolarBlocParams>): SolarBlocParams {
  return { ...DEFAULT_SOLAR_BLOC_PARAMS, ...partial };
}

/** Shipped default variant id (matches DEFAULT_SOLAR_BLOC_PARAMS after sweep). */
export const DEFAULT_SOLAR_VARIANT_ID = "solar_realist";

/** ≥10 named variants spanning early-bloc prevention / mid Neutral / late blocs. */
export const SOLAR_BLOC_VARIANTS: SolarBlocVariant[] = [
  {
    id: "control_legacy",
    label: "Control (0.9.2: no turn gate, same-body OK)",
    summary: "Legacy timing. Blocs can form as early as turn 2 from same-body affinity. Softening immediate. Use as baseline, not for play.",
    params: { ...LEGACY_SOLAR_BLOC_PARAMS },
  },
  {
    id: "late_35",
    label: "Late window T35 (route + seed fervor)",
    summary: "minTurn 35 · cities≥5 · shared route · seed fervor · soften@20 · pressure 2. Earlier late-window experiment.",
    params: withP({
      minTurnToFoundBloc: 35,
      lateBlocWindowStart: 35,
      minCitiesToFound: 5,
      midGameNeutralSofteningTurn: 20,
    }),
  },
  {
    id: "late_45",
    label: "Late window T45 (default-like)",
    summary: "minTurn 45 · cities≥6 · shared route · seed fervor · soften@25 · cd 8. Core late-bloc candidate.",
    params: withP({
      minTurnToFoundBloc: 45,
      lateBlocWindowStart: 45,
      minCitiesToFound: 6,
      midGameNeutralSofteningTurn: 25,
    }),
  },
  {
    id: "late_55",
    label: "Late window T55 (quieter)",
    summary: "minTurn 55 · cities≥7 · shared route · soften@30 · cd 10. Later blocs, slower Neutral drift.",
    params: withP({
      minTurnToFoundBloc: 55,
      lateBlocWindowStart: 55,
      minCitiesToFound: 7,
      midGameNeutralSofteningTurn: 30,
      cooldownTurns: 10,
    }),
  },
  {
    id: "late_60",
    label: "Late window T60 (very late)",
    summary: "minTurn 60 · cities≥8 · shared route · soften@35 · pressure 2. Near end of short sims for blocs.",
    params: withP({
      minTurnToFoundBloc: 60,
      lateBlocWindowStart: 60,
      minCitiesToFound: 8,
      midGameNeutralSofteningTurn: 35,
      cooldownTurns: 12,
    }),
  },
  {
    id: "route_strict",
    label: "Route-required early-ish (T40)",
    summary: "minTurn 40 · shared route mandatory · seed fervor · cities≥6 · soften@22. Same-body alone never founds.",
    params: withP({
      minTurnToFoundBloc: 40,
      lateBlocWindowStart: 40,
      requireSharedRoute: 1,
      requireSeedFervor: 1,
      minCitiesToFound: 6,
      midGameNeutralSofteningTurn: 22,
    }),
  },
  {
    id: "body_ok_late",
    label: "Same-body allowed but late (T50)",
    summary: "minTurn 50 · same-body OR route · seed fervor · cities≥6 · soften@28. Tests whether route gate is necessary once timed late.",
    params: withP({
      minTurnToFoundBloc: 50,
      lateBlocWindowStart: 50,
      requireSharedRoute: 0,
      requireSeedFervor: 1,
      minCitiesToFound: 6,
      midGameNeutralSofteningTurn: 28,
    }),
  },
  {
    id: "high_fervor",
    label: "High fervor gate (minFervor 4 @ T45)",
    summary: "minTurn 45 · minFervor 4 · seed fervor · route · soften@25. Blocs only when subjects are restless.",
    params: withP({
      minTurnToFoundBloc: 45,
      lateBlocWindowStart: 45,
      minFervor: 4,
      requireSeedFervor: 1,
      requireSharedRoute: 1,
      midGameNeutralSofteningTurn: 25,
    }),
  },
  {
    id: "early_soften_late_bloc",
    label: "Early Neutral soften (T18) + late blocs (T50)",
    summary: "soften@18 · pressure 1 · blocs@50 · cities≥6 · route. Mid-game East/West melt earlier; new blocs stay late.",
    params: withP({
      midGameNeutralSofteningTurn: 18,
      alliancePressureThreshold: 1,
      minTurnToFoundBloc: 50,
      lateBlocWindowStart: 50,
      minCitiesToFound: 6,
      requireSharedRoute: 1,
      requireSeedFervor: 1,
    }),
  },
  {
    id: "slow_soften",
    label: "Slow soften (T40, pressure 3) + blocs T55",
    summary: "soften@40 · pressure 3 · blocs@55 · cities≥7. Keeps East/West camps longer before Neutral drift.",
    params: withP({
      midGameNeutralSofteningTurn: 40,
      alliancePressureThreshold: 3,
      minTurnToFoundBloc: 55,
      lateBlocWindowStart: 55,
      minCitiesToFound: 7,
      cooldownTurns: 10,
    }),
  },
  {
    id: "solar_realist",
    label: "Solar realist (shipped default)",
    summary: "Thr-like: blocs@45 · cities≥6 · route + seed fervor · soften@25 · pressure 2 · cd 8. No turn-2 blocs; mid Neutral; late new blocs.",
    params: { ...DEFAULT_SOLAR_BLOC_PARAMS },
  },
  {
    id: "crowded_late",
    label: "Crowded board (cities≥10 @ T48)",
    summary: "minTurn 48 · cities≥10 · members≥3 · route · soften@28. Needs a denser system before solar nations form.",
    params: withP({
      minTurnToFoundBloc: 48,
      lateBlocWindowStart: 48,
      minCitiesToFound: 10,
      minMemberCount: 3,
      midGameNeutralSofteningTurn: 28,
      requireSharedRoute: 1,
      requireSeedFervor: 1,
    }),
  },
];

export function solarVariantById(id: string): SolarBlocVariant | undefined {
  return SOLAR_BLOC_VARIANTS.find((v) => v.id === id);
}

export function defaultSolarVariant(): SolarBlocVariant {
  return (
    solarVariantById(DEFAULT_SOLAR_VARIANT_ID) ??
    SOLAR_BLOC_VARIANTS.find((v) => v.id === "solar_realist")!
  );
}

/** Compact knob line for UI. */
export function solarVariantKnobLine(v: SolarBlocVariant): string {
  const p = v.params;
  const bits: string[] = [
    `bloc@T${Math.max(p.minTurnToFoundBloc, p.lateBlocWindowStart)}`,
    `cities≥${p.minCitiesToFound}`,
    `members≥${p.minMemberCount}`,
    `aff≥${p.minRelationAffinity}`,
    `fervor≥${p.minFervor}`,
    `cd ${p.cooldownTurns}`,
    p.requireSharedRoute >= 1 ? "route" : "body|route",
    p.requireSeedFervor >= 1 ? "seedFervor" : "seedFree",
    `soften@T${p.midGameNeutralSofteningTurn}`,
    `pressure ${p.alliancePressureThreshold}`,
  ];
  return bits.join(" · ");
}
