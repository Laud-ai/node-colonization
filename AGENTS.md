# AGENTS.md — Node Colonization

Solar Realist colony strategy sim (Moon → Mars). TypeScript + Vite (port **5174**). Headless engine and browser UI share the same logic. Current live version: **0.12.0** (L7).

## Authority

- **Tiago's hand-play rules and clarifications are authoritative.** Prefer them over any NOTES, PLAN, or prior agent assumption when they conflict.
- Never hardcode playtest names or events as fixed outcomes (`Fort Armstrong`, `Guanghan`, `Nüwa`, etc.). Naming stays random/procedural; seeds keep runs replayable.
- Do **not** change game rules/mechanics unless Tiago asks.

## Defaults

| Knob | Default id |
|------|------------|
| Fervor | `realistic_survival` |
| Solar / Blocs | `solar_realist` |

Lobby tabs: **Fervor**, **Solar / Blocs**, **Version / Ruleset**, **Rules**.

## Snapshots (every development point)

Every shipped point must remain playable from the in-app **Version / Ruleset** tab (`public/versions/<ver>/` + `manifest.json`).

```bash
npm run snapshot          # build current tree into public/versions/<pkg.version>, refresh manifest
npm run snapshot -- 0.x.y # pin a version folder name
npm run snapshot -- --manifest  # regenerate manifest only from NOTES-*.md
```

Write `NOTES-x.y.z.md` (first line = title) before snapshotting. Unavailable older builds stay listed with `available: false`.

## Architecture map

| Path | Role |
|------|------|
| `src/engine.ts` | Core sim loop |
| `src/session.ts` | UI session / moves / snapshots |
| `src/rules.ts` | Live rule flags (Rules tab) |
| `src/fervorVariants.ts` / `src/solarBlocVariants.ts` | Lobby presets |
| `src/l3.ts`–`src/l7.ts` | Layered features (fervor, survival, projects, flags/map, geopolitics) |
| `src/runSim.ts` / `src/cli.ts` | Headless entry |
| `src/ui/main.ts` + `index.html` | Lobby + play UI |
| `scripts/snapshot.mjs` | Frozen version builds |
| `tests/*.test.ts` | Node test suite (`npm test`) |

Sims (no rebuild needed between runs): `npm run sim`, `sim:fervor`, `sim:solar`, `sim:growth -- <turns> <seeds> [variant]`.

## Required checks before shipping

```bash
npm test
npm run build
npm run smoke
```

`smoke` builds, serves via Vite preview, and click-throughs the lobby (tabs → begin → end turn → version iframe). Screenshot: `out/smoke/smoke.png`.

## Release steps

1. Bump `package.json` `version`.
2. Write `NOTES-x.y.z.md` (Space Game decisions).
3. `npm run snapshot` (and confirm Version tab lists it).
4. `npm test && npm run build && npm run smoke`.
5. `git add -A && git commit -m "…" && git tag vX.Y.Z` (local tags; no remote required).
6. Optional tarball for Tiago's PC: `tar -czf out/node-colonization-l0-X.Y.Z.tar.gz` (exclude `node_modules`; tarballs are gitignored).

## Git

Local-only repo. Tags mark frozen points (`v0.12.0` = baseline L7). Prefer small commits after each playable change.
