# 0.9.2 — Pre-sim fervor variant setup lobby

Keeps 0.9.1 FervorParams / Subversion importer fix / `realistic_survival` default.

## Feature: setup menu before the colony board

On load (and **New game…**) the UI shows a **setup / lobby** screen *before* the main simulation:

1. Every named fervor variant from `src/fervorVariants.ts` is a clickable button.
2. Selecting a variant shows a short human-readable **summary** plus a compact **knob line** (threshold, minAge, basalCap, loyalty, solar, age pressure, …).
3. Default selection = **`realistic_survival`** (`DEFAULT_VARIANT_ID` / `DEFAULT_FERVOR_PARAMS`).
4. Independence threshold is filled from the preset; you can **override** the number before start. The in-game threshold control remains editable after Begin.
5. **Begin simulation** creates a `GameSession` with `applyFervorParams` for that variant (optional threshold override), then enters the normal board UI.
6. **New game…** returns to the lobby (does not silently reuse the last start without showing the menu).

Tone: Solar Realist pre-sim experiments — title + brief blurb on the lobby card.

## Variants exposed (all kept for in-app testing)

| id | notes |
|----|-------|
| control_legacy | 0.9.0 thr=5 bare ledger |
| thr_12 / thr_15 / thr_20 / thr_25 | threshold-only |
| dependence_loyalty | networked / young loyalty |
| power_stick | nation RP margin |
| failure_only | material failure drivers |
| alliance_lockout | denied cross-bloc trade |
| poor_admin | strain / unfair extraction |
| late_solar_hegemony | late Moon/Mars pressure |
| **realistic_survival** | **shipped default** |
| realistic_strict | quieter / slower |
| ferment_late | more late revolts |

No mid-game variant switcher — change variants via New game → lobby. Setup-only is intentional.

## API / wiring

- `FERVOR_VARIANTS[].summary`, `DEFAULT_VARIANT_ID`, `defaultVariant()`, `variantKnobLine()`
- `GameSession.create(seed, { variantId?, fervorParams?, independenceThreshold? })`
- UI phases: `setup` | `playing` in `src/ui/main.ts`

## Tests / ship

- Light test: each variant id applies without throw and syncs `independenceThreshold`; session create honors variant + override.
- `tsc --noEmit` + full suite green.
- Tarball: `out/node-colonization-l0-0.9.2.tar.gz`
