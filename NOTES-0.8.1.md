# 0.8.1 — Needs before pass, feed gates, Independent bias

Keeps 0.8.0 nation spine. Targets: fewer empty passes, real sibling feed, Independent growth, Mars not stuck.

## Changes

1. **Need-first act order** — `needScore` sorts cities by unmet Requires / missing basals / strain / Mars-without-Earth-reach before RP.
2. **Mars Earth Logistics** — Mars without an Earth-reach line only auto-imports **Earth-sourced** Logistics (Moon Logistics does not unlock Earth→Mars).
3. **Founding feed gate** — 3rd+ city of a nation requires `hasNationFeedSurplus`; Requires biased toward nodes a sibling can actually export; `tryFeedNewColony` tries Requires then missing basals.
4. **Intra-nation sibling feed** — before pass, a city with surplus exports Requires/basal to the hungriest same-nation sibling (`tryFeedHungrySibling`).
5. **Independent founding** — when cooldown ready, RP≥3, strain≤3, basal/Money surplus; may free one non-vital non-base line (RP≥5); soft cap 4 cities per liege via autoAct.

## Sim seed 42 × 40 (before → after)

| Metric | 0.8.0 | 0.8.1 |
|--------|-------|-------|
| Colonies | 13 | **11** |
| Passes | 186 | **127** |
| Develops (colony) | 59 | **84** |
| pass:develop | 3.15 | **1.51** |
| Underfed founds | 11 | **7** |
| Newborn feeds | 0 | **2** |
| Sibling feeds | 0 | present |
| Independent founds | 0 | **2** |
| Revolutions | 1 | 1 |
| Solar blocs (⚑) | 6 | 3 |
| Alliance soft/hard | 10/9 | 11/11 |
| Reach cannot-serve | 0 | 0 |
| Blackmail cuts | 17 | 21 |

## Tests

- Feed gate: nation with 2+ cities and no surplus cannot found; surplus restores founding.
- Mars autoAct prefers Earth Logistics when lacking Earth reach.
- Independent can free a non-vital line for founding.
- Determinism + full suite (68) green.

## Remaining gaps

- pass:develop still >1 on some seeds (7, 99); Mars L1s still idle when no Moon/Mars surplus exists.
- Earth Logistics excess is rare → Mars Earth unlock uncommon; Moon↔Mars feed path matters more.
- Blackmail still frequent (optional retune).
- Victory condition / player bargain UI still later.
