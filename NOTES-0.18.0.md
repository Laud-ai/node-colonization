# 0.18.0 — Neutral Commonwealth, Moon-fed Mars, ally lending, the Logistics loop

Tiago's refinements. All behind new rule toggles (Rules tab → "Earth & Mars" and "AI"); off = 0.17.1.

1. **British Commonwealth starts Neutral** (`bcNeutral`); it can still drift through the usual alliance shifts.
2. **Mars seeding** (`marsFoundingMoonAlly`): needs only a Moon colony of the founder's nation or of a same-alliance (West/East) nation. Neutral blocs and Independents count only their own nation. Thrust and the Orbital Shipyard no longer open Mars (the L5 Thrust rule is ignored; Thrust will later extend reach to asteroids). "Operational" = the Moon colony exists.
3. **Mars imports only from Moon colonies** (`marsMoonOnlyImports`): no Earth imports, Earth cycles, Earth fills or Earth Logistics for Mars; Moon lines lent to Mars colonies work as before. Mars↔Mars trade was already allowed and is unchanged. The needs-tree supplier list says why Earth is blocked.
4. **Lending** (`aiLendAllies`): allies (same nation, or same West/East alliance) always lend a line when asked; West↔East opponents always refuse. No hoarding: a bigger ally with no free line hands over a line that is only cycling Earth (or carries a non-critical import) to a smaller ally with no line for a Requires/survival need, and returns a borrowed line it no longer needs critically when the smaller lender needs it.
5. **Logistics loop** (`aiLogisticsLoop`): unless it can develop or get a critical resource (Requires, missing basics, or a survival shortfall), a colony imports Logistics from Earth when a slot is there (+1 line; kept, never cycled away); otherwise keeps cycling Earth nodes; with spare lines (≥2 free) fills its own/allied/Neutral Earth blocs, the one closest to unlocking first.
6. Turn order unchanged (highest RP first). 7. Projects unchanged except the Orbital Shipyard text (+1 Thrust, no Mars reach).

## Before / after (seeds 42, 7, 99, 123, 5 × 120 turns, `npm run sim:passes`)
| | 0.17.1 | 0.18.0 |
|---|---|---|
| Pass rate (L1) | 33.4% (72.0%) | 27.7% (79.2%) |
| Develops / seed | 437 | 653 |
| Develop Gini / top colony share | 0.42 / 15.6% | 0.43 / 13.3% |
| Earth cycles / seed | 33.8 | 9.8 |
| Logistics imports / seed (Earth + colony) | 33.2 + 20.8 | 37.0 + 23.2 |
| Earth slots unlocked / seed | 89.4 | 97.2 |
| Mars colonies at T120 / seed | 5.0 | 5.4 |
| First Mars founding (per seed) | T41, 24, 29, 24, 24 | T35, 24, 24, 24, 29 |
| Mars pass rate / Mars develops per seed | 62% / 45 | 78% / 49 |
| Moon→Mars lent lines / seed | 6.2 | 5.6 |
| Revolutions (total) | 43 | 39 |
| Colonies at T120 / seed | 16.6 | 17.2 |
| Refugee waves / O₂ deaths | 52 / 18 | 54 / 23 |

Determinism suite unchanged (runs without rules). 8 new tests in `tests/ai018.test.ts`.
