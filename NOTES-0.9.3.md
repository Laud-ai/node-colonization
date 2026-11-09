# 0.9.3 — Solar-bloc timing + Earth tech spam gate + lobby Diplomacy tab

Keeps 0.9.1–0.9.2 fervor params / Subversion importer fix / `realistic_survival` fervor default.

## A) Earth spontaneous tech spam

**Bug:** `earthSpontaneous` gave every Earth nation a 50% tech +1 every turn forever, logging past cap (`tech 8/5`, …) long after blocs were **Active colonial players**.

**Fix:** skip once `canBlocFound(b)` (tech ≥ cap, or uncapped US/China). No increment, no log. Capped nations still climb to their max only.

## B) Turn-2 solar blocs

**Bug:** `tryRelationFoundSolarBloc` had only a short cooldown. Same-body + culture/ideology affinity ≥2 let sibling Earth colonies (e.g. second Chinese Moon city) found a “Chinese Solar Bloc” on turn 2.

**Intent:** West (USA, SpaceX, EU) / East (China, Corporate China, Russia) / Neutral at start; East↔West trade blocked (existing); camps soften toward **Neutral in mid-game**; **new solar blocs in late-game**.

**Fix:** `SolarBlocParams` (in `nation.ts`) gate founding:
- `minTurnToFoundBloc` / `lateBlocWindowStart`
- `minCitiesToFound`, `minMemberCount`
- `requireSharedRoute` (same-body alone insufficient when on)
- `requireSeedFervor`
- cooldown, affinity, fervor
- `midGameNeutralSofteningTurn` + `alliancePressureThreshold` for West/East → Neutral

Shipped default variant: **`solar_realist`**.

## C) Param table + sweep (no rebuild per run)

- `src/solarBlocVariants.ts` — ≥10 named presets (mirrors fervorVariants)
- `src/solarBlocSweep.ts` / `npm run sim:solar` — one codebase, many presets; short sims (default 70 turns × 3 seeds)
- Outputs: `out/solar-bloc-sweep/summary.{csv,json}`

## D) Setup lobby — second tab

Pre-sim lobby tabs:
1. **Fervor** — existing variant buttons
2. **Solar / Blocs** — solar-bloc / diplomacy presets

Both apply on **Begin simulation**. **New game…** returns to lobby and remembers last selections.


## Sweep results (70 turns × seeds 42,7,99)

| variant | bloc@ | median first bloc | median first soften | early≤10? | mean blocs |
|---------|------:|------------------:|--------------------:|:---------:|-----------:|
| control_legacy | 0 | 2 | 2 | YES | 6.3 |
| late_35 | 35 | 35 | 20 | no | 2.7 |
| late_45 | 45 | 45 | 25 | no | 2.0 |
| late_55 | 55 | 55 | 30 | no | 1.7 |
| late_60 | 60 | 60 | 35 | no | 0.7 |
| route_strict | 40 | 41 | 22 | no | 2.0 |
| body_ok_late | 50 | 50 | 28 | no | 1.7 |
| high_fervor | 45 | 46 | 25 | no | 1.7 |
| early_soften_late_bloc | 50 | 50 | 18 | no | 2.0 |
| slow_soften | 55 | 55 | 40 | no | 1.3 |
| **solar_realist** | **45** | **45** | **25** | **no** | **2.0** |
| crowded_late | 48 | 50 | 28 | no | 0.7 |

**Recommended default:** `solar_realist` (= late_45 profile): no turn-2 blocs, Neutral softening ~T25, new blocs ~T45 with ~2 foundings / 70 turns.

## API

- `SolarBlocParams`, `DEFAULT_SOLAR_BLOC_PARAMS`, `LEGACY_SOLAR_BLOC_PARAMS`
- `applySolarBlocParams`, `solarBlocParamsOf`, `solarBlocMinTurn`
- `GameSession.create(seed, { solarVariantId?, solarBlocParams? })`
- `SOLAR_BLOC_VARIANTS`, `DEFAULT_SOLAR_VARIANT_ID`

## Tests / ship

- Spontaneous stop-at-cap test; default vs legacy solar founding timing; session solar variant wiring
- Existing solar-bloc / alliance unit tests use `LEGACY_SOLAR_BLOC_PARAMS` so they exercise mechanics, not the new timing gates
- Tarball: `out/node-colonization-l0-0.9.3.tar.gz`
