# 0.16.0 — Survival clocks belong to a colony's own Population

Tiago: "these should be respectively for lack of food, lack of water and lack of oxygen. Only when there is a developed population without any of these. Imported populations also dont need these and they are certainly not generally caused by all strain."

## Root cause
Since L4 the Food / Water / Oxygen clocks ticked whenever a colony had **any strain** and lacked the resource. Population was never checked, so a colony with no Population at all (a Science or Money outpost missing a prerequisite) counted down "starvation" clocks and sent refugees. Every strained colony without Food/Water/Oxygen showed "Food clock 1/3 · Water clock 1/3 · Oxygen clock 2/3". The "/3" was also stale — the trip has been 6 since 0.9.4.

## New rule (`survivalNeedsPopulation`, Rules tab → Refugees, default on)
- A clock ticks only while the colony has its **own Population** (developed, or Population is its specialty) **and** lacks that clock's resource (not developed, not specialty, not imported).
- Imported Population needs nothing. Strain is no longer a gate.
- Oxygen still never ticks on a livable body (TF ≥ 10). Health (Stability) still halves the tick rate.
- Recovery (unchanged rule `refugeeClockRecovery`): when a clock's condition is off (resource restored, or no own Population left) it drops by 1 per tick.
- When a refugee wave takes the last own Population, the remaining clocks stop in the same tick.
- Colony details show only active clocks, with the real trip and the reason, e.g. "Food clock 2/6 (no Food)".

## Did it cause the refugee waves? (headless, seeds 42, 7, 99, 123, 5 × 120 turns, `npm run sim:clocks`)
| Rules | Clock ticks | …from colonies with no own Population | Refugee waves | per turn per seed |
|---|---|---|---|---|
| pre-0.9.4 (0.9.0–0.9.3) | 16,549 | 95% | 5,324 | 8.87 |
| pre-0.9.4 balance + new clock rule | 4,765 | 0% | 1,526 | 2.54 |
| 0.9.4–0.15.4 | 5,349 | 90% | 208 | 0.35 |
| **0.16.0** | 1,251 | 0% | 58 | 0.10 |

Yes: 95% of refugee waves in 0.9.0–0.9.3 came from colonies with no Population. The new rule alone would have cut them by 71%. 0.9.4's fix (trip 3→6, 20-turn cooldown, clock recovery) only damped the symptom — 88% of waves in 0.9.4–0.15.4 were still from Population-less colonies. Colony sprawl in those versions came from founding, not refugees (colony counts are the same with or without the new rule).

Side effect (`npm run sim:growth`, same seeds): survival failure feeds fervor, so the first revolution comes later on some seeds (e.g. seed 42 turn 48 → 66, seed 99 turn 45 → 63) and total revolutions go from 51 to 45.

## Determinism
Unchanged: the determinism suite runs without `G.rules` (legacy path), which keeps the old clock behaviour. No expected values changed. 11 new tests in `tests/clocks.test.ts`.
