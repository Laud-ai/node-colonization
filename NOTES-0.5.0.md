# 0.5.0 — Continuous logistics (authoritative)

## Logistics lines
- Always: {Colony} base logistics (free, never strained).
- Logistics import: Imported {source} logistics — creates a line; does not consume one.
- Local develop Logistics: {Colony} logistics works.

## Routes
- Non-Logistics import needs a free line; route occupies it continuously.
- While active: clean import benefit (no dep strain).
- Cancel: lose clean import; Earth excess specialty-rerolls in place (list length unchanged).
- Switch: cancel + start on same line.
- Route start with node === Requires triggers develop() once (permanent dirty extra).

## Earth grow-when-all-active
- Start with exactly 1 excess. No fixed 3-slot cap.
- When every excess entry is claimed, immediately add one new free excess (specialty 80% / any 20%).
- Cancel does not grow; growth only when all current entries are active simultaneously.
- Tech +1 on each Earth export start; spontaneous 50% kept.
- Tech UI until Active colonial player (tech>=cap or US/China); then badge only.

## RP / strain
- Positives: specialty + developed + active clean imports (+ Logistics import lines).
- Strain: developed extras missing deps only.
- RP subtracts occupied line count.

## Auto-policy
1. Assign free line to Requires (else missing dep of Requires).
2. Else switch a non-Requires route to Requires.
3. Else pass. Routes persist automatically.

Out of scope: T2 combat/fervor.
