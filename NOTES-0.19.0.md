# 0.19.0 — Relay lines, oxygen wars, nomad camps, thin air

Tiago's crisis layer. Each part is its own Rules-tab toggle (new group **"Crises & Relays"**), default on; off = 0.18.0.

1. **Relay lines** (`relayLines`). A colony whose line imports only from Earth can pass the same line on to ONE other colony: the Earth good is also delivered onward (Earth import + export on one line). Reach rules apply (Moon line → Mars OK), so Mars still never trades with Earth directly, but a Moon colony relaying to Mars is now the way Earth goods reach Mars. The partner gate is the lending gate (allies yes, West↔East no, otherwise the usual assist/same-nation rules). The AI asks for a relay for its Requires, a vital need, or (on Mars) any Earth good, after own lines and after asking for a lent line. If the relaying colony ends or switches its Earth import, the relay ends. Relay lines are never free lines, can't be switched, and never carry Logistics.
2. **Oxygen wars** (`oxygenWars`), on the 0.17.0 crisis hook. In its warning turn the crisis colony:
   - **Pleads** to every colony with spare O₂ (crisis list). Allies always accept, for free. Other colonies accept if they are not West↔East opponents and their affinity is ≥ `o2PleaAffinity` (1), for a price: one developed node (its most plentiful), or failing that a step toward the supplier's bloc (ideology/culture). To get a line, the crisis colony uses a free line or frees a non-survival import (breathing first); otherwise the supplier lends a line, or frees one of its non-vital imports and lends that.
   - **Threatens.** A refusal gives a **casus belli** for `o2CasusBelliTurns` (15). The crisis colony's nation and allies may invade the refuser even past the West↔East threat block, with no Earth-threat penalty. Armed friends join with chance `o2JoinChance` (0.25/turn; ordinary invasions are 8%).
   - **Seizes.** If it is still short, it makes a desperate invasion of a same-body, non-friendly colony with spare O₂ (refusers first, then lowest RP). L4 mechanics apply (one node destroyed), with RP + `o2SeizeBonus` (2) against the defender's RP. Win = takes an Oxygen node. Loss = the uncovered Population dies now (and the Military token burns if there is one). No token is needed (desperation).
   - **Hoarder mark.** When Population dies, every colony that refused is marked a hoarder for `o2HoarderTurns` (10). Each of its trade partners gets +`o2HoarderFervor` (2) fervor for that long.
3. **Nomad refugees & camps** (`nomadCamps`). Food/Water refugees score every colony and try the best first. Scoring: same body +3, 2×min(3, spare of the lacking resource), RP/5, shared ideology +2.
   - **Accept:** the colony has spare of the lacking resource and room in all three survival resources, and is friendly (or not an opponent with affinity ≥ 1). Refugees become +1 Population there, and the host gets +`refugeeAcceptFervor` (1) for 10 turns.
   - **Arm:** a rival with Subversion and a free line sends them back as a Trojan (existing subversion).
   - **Refuse:** they try the next colony.
   - If everyone refuses, a **nomad camp** settles: a weak, bloc-less (Independent, ideology "Nomad") surface colony, capped at `nomadMaxCamps` (4).
     - Every `nomadRaidEvery` (3) turns it raids a same-body colony that refused it and has *surplus* of the lacking resource, picking the weakest-defended first. Attack 2 + age/10 vs defense 1 + 2 (Military token) + 1 (Stability). Win = steals 1 node.
     - After `nomadMaxRepels` (3) repelled raids the defender absorbs the camp.
     - After `nomadCampTurns` (20) it becomes a normal Independent founder.
     - Camps don't trade, lend or relay.
4. **Thin air** (`thinAirOxygen`). On a part-terraformed body (TF > 0, below livable 10) the Oxygen clock gives 2 turns of grace from TF ≥ `thinAirTf2` (1), and 3 from TF ≥ `thinAirTf3` (5). TF 0 = 1 turn as before; livable = no O₂ clock.

UI:
- Colony details list relays (→ / from), crisis actions, refusers, casus belli, hoarder mark, timed fervor and camp status.
- Pin alerts cover the same.
- New pin badges: ⛺ camp (brown dashed disc with a tent, top-left) and hoarder (black disc with an amber "H").
- Log lines: 🔁 relay, 🫁 plea accepted/refused, ⚖ justified war, ⚔ seize / SEIZED / SEIZE FAILED, 🏴 HOARDER, 🏕 REFUGEES ACCEPTED/ARMED/REFUSED, ⛺ NOMAD CAMP / RAID, 🛡 RAID REPELLED, ⛺→⚑ Independent.

## Before / after (seeds 42, 7, 99, 123, 5 × 120 turns, `MODES=v0180,v0190 npm run sim:passes`)
| | 0.18.0 | 0.19.0 |
|---|---|---|
| Pass rate (L1) | 27.7% (79.2%) | 21.6% (30.3%) |
| Mars pass rate | 78.3% | 55.2% |
| Develops / seed (Gini) | 653 (0.43) | 549 (0.38) |
| Develops L1 / L2-3 / L4-6 / L7-10 / L11+ | 90 / 164 / 220 / 261 / 2532 | 95 / 200 / 298 / 371 / 1781 |
| Mars develops / seed | 49 | 54 |
| Relays started (to Mars) | — | 1703 (390) |
| O₂ crises / pleas accepted / refused | 21 / – / – | 31 / 12 / 41 |
| Justified wars / seizures won–lost | – | 9 / 7–7 |
| O₂ deaths | 23 | 11 |
| Hoarder marks | – | 12 |
| Refugee waves | 54 | 92 |
| … accepted / armed / all refused → camps | – | 57 / 3 / 32 → 30 |
| Camps: raids / repelled / absorbed / became Independent | – | 38 / 69 / 20 / 10 |
| Revolutions | 39 | 51 |
| Colonies at T120 / seed | 17.2 | 20.0 (camps included) |

`v0180` mode = the 0.19.0 rules off and reproduces the 0.18.0 numbers exactly. Ablations: `noRelay`, `noO2War`, `noNomad`, `noThinAir`. In these seeds 34 of the 48 colony-turns with an O₂ clock running were on a part-terraformed body.

Tests: 9 new in `tests/crises019.test.ts`. The 0.17.1 pass test pins the 0.19 rules off on both sides.
