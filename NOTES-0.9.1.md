# 0.9.1 — Subversion importer fix + configurable fervor

Keeps 0.9.0 survival clocks / refugees / invade / editable threshold.

## Bug fix: Subversion import must not self-mark

**Root cause:** `onSubversionRouteStart` / `onSubversionDevelop` set `subversionMark = true` on the **actor** who imported or developed Subversion. The fervor ledger then charged that colony +1 permanently. Early colonies importing Subversion as a *tool* (to later Trojan-send) could tip over the old threshold-5 ledger on turn 1.

**Fix:** Importing / developing Subversion is a tool acquisition — **no** `subversionMark`, **no** importer fervor charge. Only `executeTrojanSend` marks the **target**. Tests under `0.9.1 subversion importer + fervor params` prove importer ledger is unchanged and Trojan targets still get the mark.

## FervorParams (configurable)

`G.fervorParams` (partial merge) + `G.independenceThreshold` (UI) via `fervorParamsOf` / `applyFervorParams`.

| Knob | Role |
|------|------|
| `threshold` | Independence gate (default **10**, was 5) |
| `w*` weights | ± ledger terms (subversion mark, basals, culture/ideo, strain, unfair extraction, alliance lockout, survival clocks, solar hegemony, loyalty) |
| `missingBasalCap` | Cap basal +fervor (default 3; legacy uncapped) |
| `minAgeTurns` / `youngAgeTurns` / `wYoungLoyalty` | No early revolt; young subjects stay loyal |
| `wDependenceLoyalty` / `wPowerStick` | Networked / nation-RP-margin loyalty |
| `agePressureStep` / `agePressureCap` / `wAgePressure` | Slow long-run ferment |
| `wSolarHegemony` + after-turn / min RP | Late Moon/Mars pressure vs Earth patron |

Legacy 0.9.0 behaviour: `LEGACY_FERVOR_PARAMS` (thr 5, bare ±1, uncapped basals, no min-age).

## Sweep (≥10 variants × seeds 42,7,99 × 120 turns)

Run: `npm run sim:fervor -- --turns 120 --seeds 42,7,99 --out out/fervor-sweep`

| Variant | thr | median 1st revolt | early ≤10? | median revolts | notes |
|---------|-----|-------------------|------------|----------------|-------|
| control_legacy | 5 | **2** | **YES** | 11 | broken early independence |
| thr_12 / 15 / 20 / 25 | 12–25 | — | no | 0 | threshold alone stalls revolts |
| dependence_loyalty | 12 | — | no | 0 | too quiet |
| power_stick | 12 | — | no | 0 | too quiet |
| failure_only | 8 | 12 | YES | 16 | early still possible |
| alliance_lockout | 10 | — | no | 0 | alone insufficient |
| poor_admin | 10 | — | no | 0 | alone insufficient |
| late_solar_hegemony | 12 | — | no | 0 | needs age ferment |
| **realistic_survival** | **10** | **45** | **no** | **5** | **shipped default** |
| realistic_strict | 12 | — | no | 0 | quieter / slower |
| ferment_late | 9 | 41 | no | 14 | more late revolts |

`shareIndependentEnd` includes Independent *founding* / solar-bloc paths, not only revolutions — hence high shares even when `revMed=0`.

## Recommended default (shipped)

**`realistic_survival` / `DEFAULT_FERVOR_PARAMS`:**

- threshold **10**, `minAgeTurns` **15**, young loyalty −3 for first 12 turns
- missing basal cap **3** (early colonies no longer get +6)
- failure / lockout / strain / unfair extraction weighted **2**
- age pressure +1 per 20 turns (cap 3) + solar hegemony +3 after turn 45
- dependence + power-stick loyalty −2 each

Matches design goals: almost no early independence; slow natural ferment (~T40–60 first revolt); late revolts possible for stressed / hegemonic solar subjects. Does **not** hardcode colony names.

## How to re-run

```bash
npm test
npm run sim:fervor -- --turns 120 --seeds 42,7,99 --out out/fervor-sweep
# optional single variant:
npm run sim:fervor -- --variant realistic_survival --turns 120
```

Artifacts: `out/fervor-sweep/summary.csv`, `summary.json`.

## Tests / build

- Importer does not self-mark; Trojan target still marked; turn-1 import alone cannot tip independence.
- Legacy ledger fixture tests apply `LEGACY_FERVOR_PARAMS`.
- `tsc --noEmit` + full suite green.
