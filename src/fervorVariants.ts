/**
 * Named FervorParams variants for the 0.9.1 independence sweep / 0.9.2 setup menu.
 * Do not hardcode playtest colony names — variants are pure param sets.
 */
import type { FervorParams } from "./l3.js";
import { DEFAULT_FERVOR_PARAMS, LEGACY_FERVOR_PARAMS, FERVOR_THRESHOLD } from "./l3.js";

export interface FervorVariant {
  id: string;
  label: string;
  /** Short human-readable summary for the pre-sim setup menu. */
  summary: string;
  params: FervorParams;
}

function withP(partial: Partial<FervorParams>): FervorParams {
  return { ...LEGACY_FERVOR_PARAMS, ...partial };
}

/** Shipped default variant id (matches DEFAULT_FERVOR_PARAMS). */
export const DEFAULT_VARIANT_ID = "realistic_survival";

/** ≥10 named variants spanning the design space. */
export const FERVOR_VARIANTS: FervorVariant[] = [
  {
    id: "control_legacy",
    label: "Control (0.9.0: thr=5, bare ±1, uncapped basals)",
    summary: "Legacy 0.9.0 ledger. Threshold 5, uncapped missing basals, no min-age / loyalty / solar / survival drivers. Early revolts expected.",
    params: { ...LEGACY_FERVOR_PARAMS },
  },
  {
    id: "thr_12",
    label: "High threshold only (12)",
    summary: "Legacy weights with independence threshold raised to 12. No new loyalty or failure drivers.",
    params: withP({ threshold: 12 }),
  },
  {
    id: "thr_15",
    label: "High threshold only (15)",
    summary: "Legacy weights with independence threshold raised to 15. Threshold-only experiment.",
    params: withP({ threshold: 15 }),
  },
  {
    id: "thr_20",
    label: "High threshold only (20)",
    summary: "Legacy weights with independence threshold raised to 20. Very quiet unless basals stack.",
    params: withP({ threshold: 20 }),
  },
  {
    id: "thr_25",
    label: "High threshold only (25)",
    summary: "Legacy weights with independence threshold raised to 25. Near-stall for revolts.",
    params: withP({ threshold: 25 }),
  },
  {
    id: "dependence_loyalty",
    label: "Dependence loyalty (networked / young / low RP suppress)",
    summary: "Thr 12 · dependence −3 · young loyalty −3 (15 turns) · min age 10 · basal cap 4. Networked / young subjects stay loyal.",
    params: withP({
      threshold: 12,
      wDependenceLoyalty: 3,
      wYoungLoyalty: 3,
      youngAgeTurns: 15,
      minAgeTurns: 10,
      missingBasalCap: 4,
    }),
  },
  {
    id: "power_stick",
    label: "Power-stick (nation RP margin suppresses revolt)",
    summary: "Thr 12 · power-stick −4 (margin 3) · min age 8. Strong nation RP over subjects suppresses fervor.",
    params: withP({
      threshold: 12,
      wPowerStick: 4,
      powerStickMargin: 3,
      minAgeTurns: 8,
    }),
  },
  {
    id: "failure_only",
    label: "Failure-only (missing basals / survival / low QoL)",
    summary: "Thr 8 · culture/ideo/subversion off · survival +3 · missing basals +2 (cap 6) · strain/unfair +2. Revolts from material failure only.",
    params: withP({
      threshold: 8,
      wSubversionMark: 0,
      wCultureMisalign: 0,
      wIdeologyMisalign: 0,
      wCultureAlign: 0,
      wIdeologyAlign: 0,
      wLowRp: 1,
      wHighStrain: 2,
      wUnfairExtraction: 2,
      wSurvivalFailure: 3,
      wMissingBasal: 2,
      missingBasalCap: 6,
      wAllianceLockout: 0,
      wSolarHegemony: 0,
      wBlocTrade: 1,
      wConsentingTrade: 1,
      wHighRp: 1,
      wVitalImport: 2,
      minAgeTurns: 5,
    }),
  },
  {
    id: "alliance_lockout",
    label: "Alliance-lockout (bloc/affinity denied trade adds fervor)",
    summary: "Thr 10 · alliance lockout +3 · basal cap 4 · min age 8. Denied cross-bloc trade drives revolt pressure.",
    params: withP({
      threshold: 10,
      wAllianceLockout: 3,
      wMissingBasal: 1,
      missingBasalCap: 4,
      minAgeTurns: 8,
    }),
  },
  {
    id: "poor_admin",
    label: "Poor admin (strain / mismanagement / unfair extraction)",
    summary: "Thr 10 · strain +3 (≥2) · unfair extraction +3 · survival +2 · min age 8. Mismanagement-focused ledger.",
    params: withP({
      threshold: 10,
      wHighStrain: 3,
      strainAtOrAbove: 2,
      wUnfairExtraction: 3,
      wSurvivalFailure: 2,
      missingBasalCap: 4,
      minAgeTurns: 8,
    }),
  },
  {
    id: "late_solar_hegemony",
    label: "Late-game solar hegemony (high RP Moon/Mars after T50)",
    summary: "Thr 12 · solar hegemony +4 after T40 (RP≥5) · young loyalty · min age 15 · dependence −1. Late solar subjects push vs Earth.",
    params: withP({
      threshold: 12,
      wSolarHegemony: 4,
      solarHegemonyAfterTurn: 40,
      solarHegemonyMinRp: 5,
      missingBasalCap: 3,
      wYoungLoyalty: 2,
      youngAgeTurns: 12,
      minAgeTurns: 15,
      wDependenceLoyalty: 1,
    }),
  },
  {
    id: "realistic_survival",
    label: "Combined realistic survival (shipped default)",
    summary: "Thr 10 · min age 15 · young −3 · basal cap 3 · failure/lockout/strain/unfair ×2 · age +1/20t (cap 3) · solar +3 after T45 · dependence/power-stick −2. Shipped default.",
    params: { ...DEFAULT_FERVOR_PARAMS },
  },
  {
    id: "realistic_strict",
    label: "Realistic strict (thr 12, stronger loyalty, slower age)",
    summary: "Thr 12 · stronger dependence/power-stick/young · min age 20 · basal cap 2 · age step 25 · solar after T55. Quieter / slower ferment.",
    params: {
      ...DEFAULT_FERVOR_PARAMS,
      threshold: 12,
      wDependenceLoyalty: 3,
      wPowerStick: 3,
      wYoungLoyalty: 4,
      minAgeTurns: 20,
      youngAgeTurns: 15,
      missingBasalCap: 2,
      agePressureStep: 25,
      agePressureCap: 2,
      solarHegemonyAfterTurn: 55,
      wSolarHegemony: 3,
    },
  },
  {
    id: "ferment_late",
    label: "Late ferment (age pressure + solar, thr 9)",
    summary: "Thr 9 · age +1/15t (cap 4) · solar +4 after T40 · min age 18 · young −3. More late-game revolts than default.",
    params: {
      ...DEFAULT_FERVOR_PARAMS,
      threshold: 9,
      agePressureStep: 15,
      agePressureCap: 4,
      wAgePressure: 1,
      wSolarHegemony: 4,
      solarHegemonyAfterTurn: 40,
      minAgeTurns: 18,
      wYoungLoyalty: 3,
    },
  },
];

export function variantById(id: string): FervorVariant | undefined {
  return FERVOR_VARIANTS.find((v) => v.id === id);
}

/** Default shipped variant (realistic_survival). */
export function defaultVariant(): FervorVariant {
  return variantById(DEFAULT_VARIANT_ID) ?? FERVOR_VARIANTS.find((v) => v.id === "realistic_survival")!;
}

/** Compact knob line for UI (threshold + a few key drivers). */
export function variantKnobLine(v: FervorVariant): string {
  const p = v.params;
  const bits: string[] = [`threshold ${p.threshold}`];
  if (p.minAgeTurns > 0) bits.push(`minAge ${p.minAgeTurns}`);
  if (p.missingBasalCap > 0) bits.push(`basalCap ${p.missingBasalCap}`);
  else bits.push("basalCap ∞");
  if (p.wYoungLoyalty > 0) bits.push(`young −${p.wYoungLoyalty}/${p.youngAgeTurns}t`);
  if (p.wDependenceLoyalty > 0) bits.push(`dep −${p.wDependenceLoyalty}`);
  if (p.wPowerStick > 0) bits.push(`stick −${p.wPowerStick}`);
  if (p.wSolarHegemony > 0) bits.push(`solar +${p.wSolarHegemony}@T${p.solarHegemonyAfterTurn}`);
  if (p.wAgePressure > 0 && p.agePressureStep > 0) {
    bits.push(`age +${p.wAgePressure}/${p.agePressureStep}t≤${p.agePressureCap}`);
  }
  if (p.wSurvivalFailure > 0) bits.push(`survival +${p.wSurvivalFailure}`);
  if (p.wAllianceLockout > 0) bits.push(`lockout +${p.wAllianceLockout}`);
  if (p.wHighStrain > 1) bits.push(`strain +${p.wHighStrain}`);
  if (p.wUnfairExtraction > 1) bits.push(`unfair +${p.wUnfairExtraction}`);
  return bits.join(" · ");
}

void FERVOR_THRESHOLD;
