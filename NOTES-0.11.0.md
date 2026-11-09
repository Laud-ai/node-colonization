# 0.11.0 — L6: Solar Realist presentation (flags + solar map)

Rule flag `l6Presentation` (Rules tab, default on, Legacy off).

- **Procedural flags**: each colony gets a deterministic flag built from its name, culture and lead ideology, plus its nation color. There are 5 layouts (horizontal or vertical tricolor, canton+disc, diagonal, ring) in a muted Solar Realist palette (ochre, slate, rust, bone, moss, brass). No playtest names are hardcoded.
- **Solar map panel** above the board: an Earth, Moon and Mars strip. Colony dots use nation colors, a gold ring marks Independents and a larger dot means the colony has finished a Project. Each body has a TF bar (livable at 10). Click a dot to select that colony.
- Colony cards show finished Projects and the current build with its progress.
- Rules-tab groups use the monospace brass headings.

## Decisions (decided by Space Game, Tiago may override)
- Flags are generated, not authored. When a colony changes culture or ideology, its flag changes too (it's a new identity).
- The map is a schematic strip, not orbital mechanics. Extra bodies are still deferred.
- No sim impact (UI only). Headless sims are unchanged from 0.10.0.
