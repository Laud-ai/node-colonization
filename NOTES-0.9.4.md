# 0.9.4 — Refugee & growth fix, Rules tab, Version / Ruleset snapshots

## Snapshots (Version / Ruleset tab)
- Lobby tab lists every NOTES version from `public/versions/manifest.json`. Available ones open frozen in a full-screen frame with "← Back to live lobby".
- Recovered builds: 0.9.0 (from `/workspace/node-colonization-l0.tar.gz`), 0.9.3 (pre-change tree), and every version from 0.9.4 on. Earlier versions are listed **unavailable** (no source kept on the box). 0.9.1/0.9.2 tarballs exist on Tiago's PC (`C:\Users\tjsan\...`) and could be added later.
- `npm run snapshot` = build current tree into `public/versions/<ver>/` (base `./`, no nested public) + regenerate manifest.

## Refugees / growth (balance-0.9.3: ~10 refugees/turn, ~140 colonies by T150)
Cause: global founding allowed every turn; survival clocks tripped at 3 with no recovery or per-colony cooldown.
New `Rules` (src/rules.ts, lobby **Rules** tab, each with a "legacy" value):
- foundCooldownBase 2 + foundCooldownPerColony 0.4 × colonies
- refugeeClockTrip 6 (was 3), refugeeColonyCooldown 20, refugeeClockRecovery on
Sim (`npm run sim:growth -- 120 42,7,99`): colonies T10 5, T40 11, T80 15–16, T120 17–18; refugees 0.35–0.47/turn (was 7.6–9.2); first revolt T45–56; independent majority by T120.

## Decisions (decided by Space Game, Tiago may override)
- Fervor default stays **realistic_survival**: with sane growth it already reaches an independent majority by T120, while ferment_late's first revolt came as early as T27.
- `createGame` without rules = legacy behaviour (keeps old determinism tests valid); live sessions always apply shipped rules.
