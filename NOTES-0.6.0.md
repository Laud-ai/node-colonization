# 0.6.0 — L2 corrections (Tiago)

## A. Founding tax (anti-bloat)
- Uncapped founders (US / China): pay `colonyCount` tech (starters already count as 1 → first extra costs 1).
- All other blocs: pay `2 + colonyCount`.
- On success: `colonies += 1`, deduct tax from tech (floor at 0).
- Eligibility unchanged: US/China always; others need `tech >= cap`.
- Requires stay **fully random** (no weighted Requires).

## B. Strain stacking
- One cover of a dep type covers that dep for **all different** developed node types (max across types).
- Same-type stacking: developed count D of type A requires D of each of A's deps (`1 + (D-1)`).
- Example: 2× Production need 2× Resources (or 1 Resources + Resources specialty).
- Strain = exactly 1 per missing dependency *instance* after stacking.
- No Stability-special ideology overwrite; no Stability-extra-strain diagnostic.
- Specialty still covers as 1 clean unit; clean imports do not create developed strain.

## C. Ideology (permanent, independent of Stability)
- Fields: `ideology[]`, `ideologyDevelopCount`, `ideologyImported[]`.
- **Develop** Ideology: pick from pool; 0→1 append (coexist); ≥2 overwrite index 0; if imported tags exist → blend `Imported-Developed`.
- **Import** Ideology (route start): permanently append source tag; cancel does **not** remove.

## D. Culture
- Population import (route start): permanently append culture from Earth bloc / colony source; cancel does not reverse.
- Culture develop: 50% append foreign if only one culture; else blend present cultures into a hybrid.

## E. UI
- Colony cards / detail show ideology + culture lists (blend noted).
- Found button shows founding-tax hint when a bloc is eligible.

## Packaging
- Version 0.6.0. Tests + production build should pass.
