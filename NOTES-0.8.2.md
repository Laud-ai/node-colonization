# 0.8.2 — Earth cycle, Mars lunar gate, 1 found/turn

Keeps 0.8.1 Needs/feed/Independent. Targets: Earth nations keep developing via probe trade; Moon crowded as Mars support; founding every turn when eligible.

## Knobs

| Knob | Value | Meaning |
|------|-------|---------|
| `FOUNDING_COOLDOWN_TURNS` | **0** | At most 1 found/turn (`lastFoundTurn !== turn`); no multi-turn throttle |
| `MOON_SOFT_CAP` | **8** | Soft prefer Moon→Mars only when Mars gate is open |
| `MARS_MOON_MIN_COLONIES` | **2** | Strong lunar basis: min Moon cities of the nation |
| `MARS_MOON_RP_SUM` | **4** | Strong lunar basis: combined Moon city RP |

## Changes

1. **1 colony per turn** — cooldown disabled; same-turn re-found still blocked.
2. **Earth source ranking** — legal Earth (own / Neutral / same-alliance / vital+fair) ranks ahead of all colony sources when filling Needs; intra-nation colony feed still used after Earth options exhausted or for Mars-local reach.
3. **Earth cycle (probe trade)** — with free logistics and no urgent Need matching Earth excess: import a non-vital Earth probe (`route.earthCycle`); next turn auto-cancel to reroll excess and free the slot (drives all-claimed → new excess). Cap 1 cycle route/colony; never cycle-cancel vital Requires. Log: “cycles Earth excess for growth.”
4. **Mars founding gate** — `tryFound` / Independent found use `foundingBodyFor`: Mars only if **strong lunar basis** (≥2 Moon cities with Moon RP sum ≥4 OR ≥2 with free export capacity) **OR** **lunar ally feed** (other-nation Moon with affinity≥2 or same-alliance+affinity≥1 + surplus). Otherwise force Moon. Auto-policy prefers Moon until gate opens. Moon soft-cap raised to 8 (crowding OK as Mars support).

## Sim seed 42 × 40

| Metric | 0.8.1 | 0.8.2 |
|--------|-------|-------|
| Colonies | 11 | **29** |
| Moon / Mars | — | **26 / 3** |
| Founds (log) | — | **27** (~0.7/turn) |
| Earth cycle starts | — | **17** |
| Earth cycle cancels | — | **15** |
| Earth export starts | — | **175** |
| Passes | 127 | 311 |
| Develops | 84 | 164 |

Moon-heavy as intended (Mars gate + soft-cap 8). Earth probe cycling active; Earth tech/excess churn via 175 export starts.

## Tests

- Consecutive-turn founding OK; same-turn blocked (`FOUNDING_COOLDOWN_TURNS === 0`).
- earthCycle cancel next turn rerolls / frees slot.
- Mars blocked without Moon basis; allowed with 2+ Moon siblings past soft-cap.
- Earth preferred in ranking vs colony source.
- Full suite **71** green; `tsc --noEmit` + `vite build` pass.
