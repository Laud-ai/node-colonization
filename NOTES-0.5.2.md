# 0.5.2 - Regional Power fix

## RP formula
- Starting colony with only specialty shows RP 1 (removed invisible baseline +1 and - occupiedLineCount).
- Score = bodyMod + specialty(1) + developed extras (non-Logistics) + active clean imports (non-Logistics) + extra logistics lines - strain + bodyTF[body].
- Extra logistics lines = imported or developed logistics works (kind !== base).
- Base logistics line never counts toward RP.
- Extra lines still count while occupied with a route; they do not count while lentTo is set.
- developed.Logistics is not double-counted: lines represent those buildings.

## LogisticsLine
- Optional lentTo: string | null (null = not lent). RP ignores lent lines.

## Packaging
- Version 0.5.2. Tests and production build should pass.
