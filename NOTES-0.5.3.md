# 0.5.3 — Colony level + Logistics specialty lines

## Colony level
- `level = 1 + sum over NODES of (developed[n] || 0)`
- Specialty is the starting tier (Level 1); each develop increments level by 1.
- Clean imports and logistics lines do **not** affect level.
- UI: colony cards show `L{n}` next to the name; selected detail shows `Level {n}`.

## Logistics specialty → 2 free lines
- When `specialty === "Logistics"` in `makeColony`:
  - base logistics line (as always)
  - plus `{name} specialty logistics` with `kind: "specialty"`, `route: null`, `lentTo: null`
- Non-Logistics specialties still start with 1 base line only.

## RP (no double-count)
- `rpNodeScore`: add generic specialty +1 only when `specialty !== "Logistics"`.
- Logistics specialty RP comes from `logisticsRpContribution` counting the specialty line (`kind !== "base"`).
- Starters: Food specialty → RP 1 (specialty term); Logistics specialty → RP 1 (specialty line).

## Packaging
- Version 0.5.3. Tests and production build should pass.
