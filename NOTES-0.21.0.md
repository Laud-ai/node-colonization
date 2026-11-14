# 0.21.0 — Living Colony

Tiago approved "Living Colony": colonization comes in waves, the game keeps a deterministic event log, and every colony gets a History tab. Everything is behind two new Rules-tab groups, **Colonization** and **History**. Every rule defaults on; with all four switches off (`colonizationWaves`, `firstFoundingWave`, `daughterColonies`, `eventLog`) the game is exactly 0.20.0.

Tiago's ruling: **wave colonies are not less loyal.** Rushed colonies get the normal fervor and loyalty, so the cluster graph (0.21.1) can replay history as it happened.

## Colonization (group "Colonization")
| id | default | what it does |
|---|---|---|
| `colonizationWaves` | on | **Pressure meter per Earth bloc.** Each turn: `pressureBase` + `pressurePerSlot` × filled Earth node slots + `pressurePerRival` × rival colonies on reachable bodies where the bloc has none; × `pressureZeroBoost` while the bloc has no colony. Crossing the threshold founds a colony even without the tech cap, and empties the meter. A bloc's very first colony skips the shared founding cooldown (max one such per turn); later ones wait for it and need the 0.20.0 feed surplus. |
| `pressureBase` / `pressurePerSlot` / `pressurePerRival` | 0.3 / 0.15 / 0.05 | Meter inputs. |
| `pressureZeroBoost` | 2 | Multiplier while the bloc has no colony. |
| `pressureThreshold` | 30 | Base threshold. |
| `pressureGrowth` | 2 | Threshold × (1 + this × colonies the bloc has ever founded). Keeps big blocs from snowballing (revolutions don't reset it). |
| `firstFoundingWave` | on | **First-founding wave.** A bloc's first colony on a body pays no founding tax and opens a wave on that body for `waveTurns` turns (+2 per 0.5 strength). Strength = `waveRivalScale` × rival colonies there (max 1). During the wave, the meter grows ×(1 + strength) plus a push, and the bloc founds there once the meter reaches `waveThresholdFactor` × base threshold, tax-free, ignoring the shared cooldown. Logged as 🌊 WAVE. |
| `waveTurns` | 5 | Window length. |
| `waveRivalScale` | 0.05 | Strength per rival colony on the body. |
| `waveMaxColonies` | 1 | Extra colonies per wave. |
| `waveThresholdFactor` | 0.5 | Wave threshold as a share of the base threshold. |
| `daughterColonies` | on | **Daughter colonies.** A bloc colony at level ≥ `daughterMinLevel` with a free line seeds a colony on its own body or one step out (Moon→Mars if the bloc has no Mars colony, Mars→Belt with belt reach). If it has no free line, it may drop a non-vital import (never its Requires, a relay, or a lent or borrowed line). It spends that line, and the daughter inherits culture and ideology. Its first daughter on a new body opens that body's wave. A daughter is one way a bloc releases pressure: it needs the meter at `daughterPressure` × the current threshold, and it empties the meter. Never while the parent runs a survival clock or an O₂ crisis. One daughter per turn across the whole system. |
| `daughterMinLevel` | 5 | Parent level. |
| `daughterPressure` | 0.5 | Share of the bloc threshold needed. |
| `daughterCooldown` | 25 | Turns between daughters of one parent. |
| `foundPerBlocPerTurn` | 1 | **Brake:** foundings per bloc per turn. **Supply brake:** a wave stalls (🌊 WAVE stalls) when a founder with 2+ colonies has no feed surplus. |

## Event log (group "History")
`eventLog` (on) keeps `GameState.events`: a deterministic, append-only record with `{seq, turn, type, colonies, blocs, names, tags, before, after, parents, parentColony, text}`. Types:
- `found` (tags `first`, `pressure`, `wave`, `daughter`, `tech`, `independent`; daughters carry `parentColony`) and `camp`
- `war`, `seize`, `o2`, `raid`
- `allianceShift`, `patronChange`, `revolution`, `independence`, `annex`
- `ideology` and `culture` (`import`, `develop` (append / coexist), `blend` with `parents`, `overwrite` with the replaced tags as parents, `shift` for unlogged changes)
- `wave`, `milestone`, `lost`

`GameState.timeline` gets one relation snapshot per turn: bloc alliances, plus every colony's patron, liege, body, level, ideology, culture, trade partners and war flag. 0.21.1's Lineage tree and replayable cluster graph read from this. The log is a pure record: the game plays out identically with it off (tested).

## UI
- **Selected colony → Details | History tabs.** History is a template-written chronicle (no AI text), grouped into **eras**. A new era starts whenever the colony's bloc or lead ideology changes, e.g. "Era 4: Independent · Chinese Socialism-Situationism T46–T49". Founding and waves show in green, wars and revolutions in red, identity changes in violet. The tab choice sticks when you select another colony.

## Per-bloc sim (seeds 42, 7, 99, 123, 5 × 120 turns, `MODES=v0200,v0210 npm run sim:blocs`)
"First colony" is the turn of the bloc's first founding in each seed (— = never).

| bloc | 0.20.0 first colony | 0.20.0 founded avg | 0.21.0 first colony | 0.21.0 founded avg |
|---|---|---|---|---|
| United States | 1, 1, 1, 1, 1 | 1.6 | 1, 1, 1, 1, 1 | 1.6 |
| China | 1, 1, 1, 1, 1 | 2.6 | 1, 1, 1, 1, 1 | 3.0 |
| SpaceX | —, —, —, —, 11 | 0.2 | 22, 27, 22, 23, 11 | 1.0 |
| Corporate China | never | 0.0 | 24, 26, 24, 22, 23 | 1.2 |
| European Union | —, —, —, —, 7 | 0.2 | 23, 24, 26, 26, 7 | 1.4 |
| Russian Federation | —, 7, —, —, — | 0.2 | 21, 7, 28, 27, 27 | 1.0 |
| Latin Federation | 19, 29, 16, 29, 61 | 2.4 | 19, 21, 16, 20, 26 | 1.2 |
| African Union | 35, 15, 28, 19, 24 | 3.0 | 26, 15, 21, 16, 25 | 1.4 |
| New Caliphate | never | 0.0 | 28, 22, 27, 28, 31 | 2.0 |
| South Asian Commonwealth | 15, —, 11, —, — | 0.6 | 15, 23, 11, 24, 24 | 1.4 |
| East Asian Pacific Alliance | 11, 11, —, 11, — | 1.0 | 11, 11, 18, 11, 30 | 1.4 |
| Dominion of Indochina | never | 0.0 | 29, 19, 25, 29, 29 | 1.8 |
| British Commonwealth | —, 35, —, 35, 15 | 1.4 | 27, 25, 23, 25, 15 | 1.6 |
| United Nations | 7, —, —, 7, — | 0.4 | 7, 18, 29, 7, 28 | 2.2 |

| metric | 0.20.0 | 0.21.0 |
|---|---|---|
| bloc-seeds that never colonize | 37 / 70 | **0 / 70** (all by T31) |
| total colonies / seed | 19.0 | 26.2 |
| belt colonies / seed (alive at end) | 0.4 | 0.0 (10 more seeds: 0.5 → 0.3) |
| foundings tagged pressure / wave / daughter (5 seeds) | — | 46 / 21 / 5 |
| pass rate (`sim:passes`) | 20.9% | 27.6% (L1 28% → 52%, Mars 49% → 73%) |
| events / seed | — | ~650 |

Ablations (same seeds): no waves 23.2 colonies/seed, no daughters 24.2, no pressure 21.8 (41/70 never colonize).

"Held at end" is ≈0 in both versions: with the default rules almost every colony revolts to Independent by T120. That is existing behaviour.

## Known trade-offs
- Totals rise from 19 to 26 per seed, mostly because 10 more blocs now each found 1–2 colonies.
- Pass rate rises (more young, small colonies of minor blocs that lack Earth reach). Tune with `pressureGrowth` or `pressureThreshold`.
- Belt colonies stay rare (0.0–0.3/seed vs 0.4–0.5).
- Tests: `tests/rules.test.ts` keeps the 0.20.0 growth band (6–14 at T40) with Colonization off; the default band is now 8–24. `tests/ai.test.ts` pins Colonization off to isolate the 0.17.1 AI rules.

## Tests
`tests/colonize021.test.ts` covers: pressure and zero boost, tax-free first founding plus wave, every bloc founding by T45, rules off = no meter, waves or tags, per-bloc cap, wave cap and supply brake, daughters, event log (tags, blend parents, no double revolution, one snapshot per turn), History eras, and determinism with the log off. E2E `tests/e2e/history.spec.ts` covers seed 42 at 60 turns, with screenshots `out/smoke/history-tab.png` and `history-eras.png`.
