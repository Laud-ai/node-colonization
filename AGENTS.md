# AGENTS.md — Node Colonization

Solar Realist colony strategy sim (Moon → Mars). TypeScript + Vite (port **5174**). Headless engine and browser UI share the same logic. Current live version: **0.13.1** (L7 + 3D Moon/Mars globes with pin markers).

**Live (GitHub Pages):** https://laud-ai.github.io/node-colonization/  
**Repo:** https://github.com/Laud-ai/node-colonization

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

Snapshot builds use Vite `base: "./"` (relative asset URLs) so they load under GitHub Pages at `/node-colonization/versions/<ver>/`. The live app builds with `base: "/node-colonization/"`; local `npm run dev` stays at `/`.

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
| `src/ui/globe.ts` | 0.13.0 Solar view: three.js Moon/Mars globes (lazy `import()`), HUD markers, hover/click select. Reads the UI snapshot only, never sim state |
| `src/ui/pinIcon.ts` | 0.13.1 pin heads (bloc color, level number, fervor ring, specialty badge, alerts), stem tiers, halo helper |
| `src/ui/hudIcon.ts` | Level glyphs from the Sep 1 Moon Globe (L1 dot, L2–4 3-wedge, L5–9 6-wedge, L10+ rings) |
| `src/ui/colonySites.ts` | Pure deterministic colony lat/lon (hash of seed + id, ≥10° spacing, stable across turns) |
| `src/ui/textures/` | `moon.jpg` (NASA SVS CGI Moon Kit, LROC WAC), `mars.jpg` (Viking MDIM 2.1 colorized, NASA/JPL/USGS); imported via `?url` so they bundle into live + snapshot builds |
| `src/ui/flags.ts` | Procedural flags + old solar map strip (kept under the globes) |
| `scripts/snapshot.mjs` | Frozen version builds |
| `tests/*.test.ts` | Node test suite (`npm test`) |
| `.github/workflows/pages.yml` | CI test + build + GitHub Pages deploy |

Sims (no rebuild needed between runs): `npm run sim`, `sim:fervor`, `sim:solar`, `sim:growth -- <turns> <seeds> [variant]`.

## Required checks before shipping

```bash
npm test
npm run build
npm run smoke
```

`smoke` builds (Pages base), serves via Vite preview under `/node-colonization/`, and click-throughs the lobby (tabs → begin → end turn → globes load + markers after 18 simulated turns → pins default + glyph toggle → version iframes 0.9.0 and 0.12.0). Screenshots: `out/smoke/smoke.png`, `globes.png`, `globe-moon.png`, `globe-mars.png`, `pins-closeup.png`, `glyphs-closeup.png`.

## Release steps

1. Bump `package.json` `version`.
2. Write `NOTES-x.y.z.md` (Space Game decisions).
3. `npm run snapshot` (and confirm Version tab lists it).
4. `npm test && npm run build && npm run smoke`.
5. `git add -A && git commit -m "…" && git tag vX.Y.Z`.
6. `git push origin main --tags` — push to **main** triggers `.github/workflows/pages.yml`, which runs tests, builds with base `/node-colonization/`, and deploys to GitHub Pages (https://laud-ai.github.io/node-colonization/).
7. Optional tarball for Tiago's PC: `tar -czf out/node-colonization-l0-X.Y.Z.tar.gz` (exclude `node_modules`; tarballs are gitignored).

## Git

Remote: `Laud-ai/node-colonization` (public). Default branch **main**. Tags mark frozen points (`v0.12.0` = baseline L7, `v0.13.0` = globes, `v0.13.1` = pins). Prefer small commits after each playable change.
