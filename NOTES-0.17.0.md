# 0.17.0 — Scaled survival cover, Tiago's 3/2/1 clocks, Oxygen kills

Tiago's answers to the 0.16.0 rule questions (rule `survivalScaledCover`, Rules tab → Refugees, default on; off = 0.16.0 clocks):

1. **Scaled cover:** N developed Population needs N Food, N Water and N Oxygen. Owned (developed + specialty) and imported units count. A shortfall in a resource ticks that resource's clock.
2. **Population specialty:** one extra Population that is fed, hydrated and oxygenated for free (counts as Population, needs no cover). Imported Population still needs nothing.
3. **Oxygen** never ticks once the body is livable (unchanged).
4. **Stability** halves the tick rate only if at least half of its prerequisites (Culture, Ideology, Military, Food, Water — i.e. 3 of 5) are owned or imported.
5. **Clock lengths:** Food 3, Water 2, Oxygen 1 turns of grace (rules `clockTripFood/Water/Oxygen`). The clock fills one step per short tick and fires on the next short tick after it is full — e.g. Oxygen shows 1/1 for one turn, then the Population dies if nothing changed. Wind-down (−1 per covered tick) kept. The 0.9.4 per-colony refugee cooldown (20 turns) is **not** applied: it would contradict "food is 3 turns".
6. **Oxygen kills:** when the Oxygen clock fires, the uncovered developed Population dies (`☠ N Population died in X (no Oxygen)`); nobody migrates. Food and Water still send refugees (1 Population per wave).
7. **Display:** "Water clock 1/2 (2 Pop, 1 Water)"; pin tooltip and colony card show the real thresholds.

**Oxygen crisis hook (no AI yet):** while the Oxygen clock runs, the colony records `oxygenCrisis` (since, shortfall, up to 6 colonies with spare Oxygen that are not sending any — same body first). It shows as an "O₂" badge on the pin, an alert in the pin tooltip, and a ☠ line in colony details listing those colonies. Oxygen war, blackmail and refugee invasions are not implemented yet; they are being designed with Tiago.

## Numbers (5 seeds 42, 7, 99, 123, 5 × 120 turns)
| | 0.16.0 | 0.17.0 |
|---|---|---|
| Refugee waves / turn / seed (`sim:clocks`) | 0.10 (58) | 0.02 (12) |
| Population died of no Oxygen | 0 | 15 |
| Revolutions (`sim:growth`, total) | 45 | 54 |
| Colonies at turn 120 (mean) | 19.6 | 19.2 |

## Determinism
Unchanged: the determinism suite runs without `G.rules` (legacy clocks). 11 new tests in `tests/clocks.test.ts`.
