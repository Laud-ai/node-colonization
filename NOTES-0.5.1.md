# 0.5.1 — Random mode + naming + Needs bar

## Game mode
- `GameState.gameMode`: `"random" | "realistic"`. Always `"random"` in this version.
- Random ignores `SPECIALTIES` pools: Earth excess / grow / cancel-reroll, colony specialty, and requires all draw from full `NODES` (requires ≠ specialty).
- Realistic (specialty pools / patterned Earth) deferred.

## Naming
- `{NationAdj} {Specialty} {BodyAdj}` — e.g. `American Military Lunar`, `Chinese Science Lunar`.
- Body: Moon→Lunar, Mars→Martian. Collision: append ` 2`, ` 3`, …
- Replaces old `Lunar Military 1` style.

## Starters
- US + China still patron the two Moon starters; specialty/requires fully random.

## UI
- Selected colony: Needs group after Developed / Clean imports / Free excess (Requires + missing deps of strained developed nodes).
- Colony list cards still show Requires.
