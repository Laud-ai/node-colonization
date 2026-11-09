# 0.10.0 — L5: Thrust reach + Projects (rule-changers)

All new systems are lobby **Rules** flags (Rules tab, group "L5 Projects / Thrust"); "Legacy" turns them off.

## Thrust
- `l5Thrust`: a colony of the same nation/liege with Thrust extras ≥1 (or a finished Orbital Shipyard) opens Mars founding, as an alternative to the lunar-basis gate.

## Projects
- `l5Projects`, unlock `projectsMinTurn` 30, cost `projectCost` 20.
- Progress/turn = 2 × Projects extras, +1 if the colony has both Production and Science extras.
- Random pool per colony, each built once: **Orbital Shipyard** (+1 Thrust), **Terraforming Megaproject** (body TF +2), **Earth-Independent Supply Chain** (subject fervor +`projectFervor`, default 2).
- Log: `🏗 PROJECT: <colony> completes <project>`.

## Sim (`npm run sim:growth -- 120 42,7,99`)
Projects: 17–25 per run, first completion T36–39. Colonies T40 11, T120 18–19. Refugees 0.30–0.40/turn. First revolt T45–75. Independent at T120: 9/18, 14/18, 16/19. Moon TF reaches ~14–20 by T120, which makes it livable late.

## Decisions (decided by Space Game, Tiago may override)
- Thrust **adds to** Earth/lunar reach and doesn't replace it. It's a standing capacity (developed extras), not fuel.
- Invasions stay same-body only. Thrust doesn't enable cross-body invasion yet.
- No early bonus for Thrust-preference Earth nations beyond their existing tech preference.
- Projects: one active per colony, each project at most once per colony. No ally chip-in and no sabotage in v1.
- The Supply Chain project adds fervor (self-reliance feeds the solar hegemon arc). The other projects are neutral.
- Map: no new bodies in L5 (Moon/Mars only). Extra bodies (Ceres, Phobos) and the map view are left to L6/L7.
- The Terraforming Megaproject can make the Moon livable late (TF ≥10). Turn `l5Projects` off or raise `projectCost` if that feels too fast.
