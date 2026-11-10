# AGENTS.md — Node Colonization

Solar Realist colony strategy sim (Moon → Mars). TypeScript + Vite (port **5174**). Headless engine and browser UI share the same logic. Current live version: **0.19.0** (L7 + map-first globes, pins, needs tree, suppliers, trade routes, vexillological flags; survival clocks: scaled cover, 3/2/1 clocks, O₂ deaths; RP turn order + AI that spreads develops; 0.18.0 Neutral BC, Moon-gated Moon-fed Mars, ally lending, Logistics loop; 0.19.0 relay lines, oxygen wars, nomad camps, thin air).

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
| `src/engine.ts` | Core sim loop. 0.17.1 (Tiago, group "AI" rules): `aiTurnOrderRp` → `sortedColonies` highest RP first (off = need score first, which looked like lowest-RP-first); `aiSpreadDevelop` (+`aiSpreadGap` 3) → `reservedForSmallerFriends` (big colony leaves a shared Requires source to a friend ≥3 levels smaller that hasn't acted), `tryFeedFriendRequires` (feed a smaller friend's Requires first), `tryRecallLentLine`, no borrowing from much smaller colonies (`pickBestLender` minLenderLevel); `aiActiveEarth` → before passing: `tryImportLogisticsForCapacity` (Earth / same-nation Logistics), `tryCoopEarthUnlock` (move a non-vital route onto a friendly bloc closest to filling), feed any friend's Requires. Friends = `friendlyColonies` (same nation or same non-Neutral alliance). Debug: `diagnosePass` + `G.__passTrace/__actTrace/__devTrace/__lendTrace/__logiTrace`. **0.18.0 (Tiago):** `bcNeutral` (startTurn T1 flips BC West→Neutral); `marsFoundingMoonAlly` (`nation.ts hasFriendlyMoonColony`: own nation or same West/East alliance Moon colony; Neutral/Independent = own nation; Thrust/Shipyard never open Mars); `marsMoonOnlyImports` (`marsEarthless`: Mars gets no Earth sources/cycles/fills/Earth Logistics; Mars↔Mars unchanged); `aiLendAllies` (`pickBestLender`: allies always lend, West↔East always refuse, an ally keeps its last free line if it needs it for its own Requires this turn, a bigger ally hands over a cycling/non-critical line to a smaller line-less ally (`hoardedLines`), `tryRecallLentLine` = bigger ally returns a non-critical borrowed line; a colony still never *asks* a ≥3-levels-smaller one); `aiLogisticsLoop` (after needs/founding: `tryImportLogisticsForCapacity` → with ≥2 free lines `tryFillFriendlyEarth` (kept claim) → `tryEarthCycle` → fill; survival shortfalls count as needs) |
| `src/crises.ts` | 0.19.0 (Tiago, group "Crises & Relays", each its own toggle; off = 0.18.0). `relayLines`: `tryRelay` (taker gets a kind "borrowed" line with `relay: true`, `borrowedFrom` = giver Earth line; giver line gets `relayTo`; one relay per line; reach via `reachSupports`; partner gate `partnerOk` = lending gate). Called in engine `tryStart` when no source exists or after the lend attempt fails; only for Requires / vital / Mars. `clearRouteOnLine` drops relays both ways; `switchRoute` refuses relay lines; `freeLines` excludes them; `sweepCrises` (in cleanup) fixes stale relays and expires timed state. `oxygenWars`: `runOxygenCrisis` at the start of `autoAct` (plead → refuse = `casusBelli` → `seizeOxygen`); `deliverOxygen` (crisis colony frees a non-survival import, else the supplier lends or frees+lends a line); `markHoarders` via `L4Deps.onOxygenDeaths`; `fervorEvents` summed in `fervorHooks.extraFervor`. l4: `hasCasusBelli` (nation/allies share it) bypasses `westEastInvadeBlocked` and the threat raise; `maybeAutoInvade` joins justified wars at `o2JoinChance`. `nomadCamps`: `nomadRefugees` via `L4Deps.nomadRefugees` in `emitRefugees` (food/water): accept (+1 Population, needs room in Food/Water/O₂) / arm (Trojan) / refuse → camp (`Colony.nomad`, Independent, ideology "Nomad"; `campAct` replaces its autoAct: raid surplus stores of same-body rejecters, absorbed via `annexColony` after max repels, → Independent after `nomadCampTurns`); `colonyTradeOk` and `pickBestLender` exclude camps. `thinAirOxygen`: l4 `oxygenTripFor` / `clockTripsFor` (used in `tickScaledClocks` and snapshots). Probe: `passProbe` modes `v0190`, `v0180` (= OFF019), `noRelay/noO2War/noNomad/noThinAir`, with 0.19 metrics from stable log markers. |
| `src/session.ts` | UI session / moves / snapshots |
| `src/rules.ts` | Live rule flags (Rules tab) |
| `src/fervorVariants.ts` / `src/solarBlocVariants.ts` | Lobby presets |
| `src/l3.ts`–`src/l7.ts` | Layered features (fervor, survival, projects, flags/map, geopolitics) |
| `src/l4.ts` `tickSurvivalClocks` | 0.16.0 (Tiago, rule `survivalNeedsPopulation`, default on): the Food / Water / Oxygen clock ticks only while the colony has its **own** Population (`hasNativePopulation`: developed or specialty; imported Population needs nothing) **and** lacks that resource (`extras ≤ 0`: not owned, not imported). Strain is not a gate. Oxygen still never ticks on a livable body. Recovery (`refugeeClockRecovery`) decays a clock by 1 per tick when its condition is off. Rule off / no `G.rules` = old strain-gated behaviour (determinism tests). Never show `/3` — the UI reads `ColonySnap.clockTrips`. **0.17.0 (Tiago, rule `survivalScaledCover`, default on → `tickScaledClocks`):** N developed Population needs N Food / N Water / N Oxygen (`survivalCover` = owned + imported); shortfall ticks that clock; Population specialty = +1 free Population (`freePopulation`, needs nothing); Oxygen 0 need on a livable body; Stability halves only if `stabilityBacked` (≥ half of DEPS.Stability owned/imported); turns of grace Food 3 / Water 2 / Oxygen 1 (`clockTripFood/Water/Oxygen`), fire on the next short tick; Food/Water → `emitRefugees`, Oxygen → `oxygenDeaths` (uncovered Population dies, log `☠`); wind-down kept, per-colony refugee cooldown not used. Hook for future O₂ war/blackmail (NOT implemented yet — being designed with Tiago): `Colony.oxygenCrisis {since, shortfall, suppliers}` via `oxygenSuppliersNotTrading`; pin badge `o2Crisis`, colony-details line `[data-o2-crisis]` |
| `src/needs.ts` | 0.15.3 states (`classifyNeed`): specialty / developed / imported / missing / expand / locked — owned states win; `short` = owned but under-covered. 0.15.4 (Tiago): **missing (red) only for a direct prerequisite of a developed node that the colony lacks** (`neededByDeveloped`; mirrors sim strain, which only developed nodes create) — never just for Requires/basal; **grey** = basics (BASAL_NODES) or nodes whose prerequisites are all owned; **locked** = the rest. Supplier ranking still uses `missingNodes`/`noStrainExpansions`. 0.14.0 read-only analysis: `missingNodes`, `noStrainExpansions` (engine `strainOf` on a copy), `needsTree`, `listSuppliers` + `compareSuppliers` (uses `findSources`/`listMoves`/`rankTradeSource`) |
| `src/runSim.ts` / `src/cli.ts` | Headless entry |
| `src/ui/main.ts` + `index.html` | Lobby + play UI (0.14.0 map-first: globes fill the stage, panels are `.win` side windows) |
| `src/ui/windows.ts` | Side-window manager: dock left/right, minimize to tray, close/reopen via Windows menu, layout in localStorage `nc.layout.v1` |
| `src/ui/needsView.ts` | Needs tree SVG + supplier cards HTML. 0.15.3: inverted (basics at the bottom, builds upward); `NEED_STYLE` = Tiago's colours (specialty blue, developed green, imported yellow, missing red, expansion grey) + icon/border-style cue per state + legend |
| `src/ui/globe.ts` | 0.13.0 Solar view (0.14.1: `setRoutes` draws regional arcs + outer lines with flag labels from `UiSnapshot.routes`; 0.15.2: each pin/glyph carries the colony's own flag (`GlobeMarker.flagSvg`, pennant under the head), route ends show a smaller framed partner flag (text on hover) that fades when it would cover a pin; `data-route-flags*` / `data-pin-flags-loaded` attributes for smoke): three.js Moon/Mars globes (lazy `import()`), HUD markers, hover/click select. Reads the UI snapshot only, never sim state |
| `src/ui/pinIcon.ts` | 0.13.1 pin heads (bloc color, level number, fervor ring, specialty badge, alerts), stem tiers, halo helper. 0.15.1: fervor ring is 3 segments (1/2/3 lit) + dashed outer ring when critical (`fervorCue`) — a non-colour cue |
| `src/ui/hudIcon.ts` | Level glyphs from the Sep 1 Moon Globe (L1 dot, L2–4 3-wedge, L5–9 6-wedge, L10+ rings) |
| `src/ui/colonySites.ts` | Pure deterministic colony lat/lon (hash of seed + id, ≥10° spacing, stable across turns) |
| `src/ui/textures/` | `moon.jpg` (NASA SVS CGI Moon Kit, LROC WAC), `mars.jpg` (Viking MDIM 2.1 colorized, NASA/JPL/USGS); imported via `?url` so they bundle into live + snapshot builds |
| `src/flagDesign.ts` | 0.15.0 flag grammar (pure, deterministic): tinctures, NAVA rules + rule of tincture, 14 bloc traditions, ideology families, specialty charges, colonial/flip/independent eras → `flagDesignToSvg`. Grammar: `docs/flags.md` |
| `src/flagLineage.ts` | Builds `FlagInput` from game state (`Colony.originPatron` lineage, liege) — `flagForColony`, `flagForEarth`; snapshots carry `ColonySnap.flag`, `Supplier.flag`, `RouteSnap.fromFlag/toFlag` |
| `src/ui/limb.ts` | 0.15.3 `limbVisibility`: pin heads/alerts/pin flags/route flags are sprites with depthTest off; each anchor is ray-tested against the body (hidden behind it, faded at the horizon) so billboards never cut into the globe. `GlobeView.refit()` restores the default distance on view-mode change |
| `src/ui/svgUrl.ts` | `svgDataUrl` — SVG → data URL, adds xmlns only if missing (a duplicate xmlns broke flag images in Firefox in 0.15.0–0.15.1). Always use it for SVG-to-canvas/texture |
| `src/ui/flagGallery.ts` | Dev gallery (`?flags` or Rules tab → Flag gallery): synthetic samples only |
| `src/ui/flags.ts` | Solar map strip (0.15.0: tiny flags as colony markers); legacy `flagSvg` deprecated (old test only) |
| `out/reports/visual-overhaul-assets.md` | 0.15.0 visual-overhaul asset list (designer tokens, P1–P3, source code/NASA/rfab; no reskin applied yet) |
| `scripts/snapshot.mjs` | Frozen version builds |
| `tests/*.test.ts` | Node test suite (`npm test`) |
| `.github/workflows/pages.yml` | CI test + build + GitHub Pages deploy |

Sims (no rebuild needed between runs): `npm run sim`, `sim:fervor`, `sim:solar`, `sim:growth -- <turns> <seeds> [variant]` (`CLOCKS=094|016` = older clocks; prints O₂ deaths), `sim:passes -- <turns> <seeds>` (`MODES=v0170,v0171`: pass rate by turn/level/bloc, pass reasons, turn-order check, develop spread Gini/top share, Earth cycles/unlocks), `sim:clocks -- <turns> <seeds>` (`MODES=legacy,legacyPop,v094,v016,v017`: clock advances / refugee events and how many came from colonies without a native Population; debug trace via `G.__clockTrace`).

## Required checks before shipping

```bash
npm test
npm run build
npm run smoke
```

`smoke` builds (Pages base), serves via Vite preview under `/node-colonization/`, and click-throughs the lobby (tabs → begin → end turn → globes load + markers after 18 simulated turns → pins default + glyph toggle → needs tree → supplier menu → minimize/restore a window → routes layer + toggle → 60 more turns (late game) → flags on cards + map strip → version iframes 0.9.0 and 0.12.0 → `?flags` gallery). Screenshots: `out/smoke/smoke.png`, `globes.png`, `globe-moon.png`, `globe-mars.png`, `pins-closeup.png`, `glyphs-closeup.png`, `needs-tree.png`, `suppliers.png`, `map-first.png`, `routes-late-game.png`, `flags-gallery.png`, `flags-small.png` (real 24×16 small-mode flags at 3× DPR), `pin-flag-closeup.png`, `needs-tree-fresh.png` (turn 1: no red, basics grey), `needs-tree-midgame.png`, `needs-tree-states.png` (late-game colony with the most states), `globe-limb-moon.png`, `globe-limb-mars.png`. Smoke asserts route-label flags load and render (no failures, inked pixels) and pins get their own flags. Smoke runs Chromium only — check SVG-as-image changes in Firefox too (`npx playwright install firefox`).

## Release steps

1. Bump `package.json` `version`.
2. Write `NOTES-x.y.z.md` (Space Game decisions).
3. `npm run snapshot` (and confirm Version tab lists it).
4. `npm test && npm run build && npm run smoke`.
5. `git add -A && git commit -m "…" && git tag vX.Y.Z`.
6. `git push origin main --tags` — push to **main** triggers `.github/workflows/pages.yml`, which runs tests, builds with base `/node-colonization/`, and deploys to GitHub Pages (https://laud-ai.github.io/node-colonization/).
7. Optional tarball for Tiago's PC: `tar -czf out/node-colonization-l0-X.Y.Z.tar.gz` (exclude `node_modules`; tarballs are gitignored).

## Git

Remote: `Laud-ai/node-colonization` (public). Default branch **main**. Tags mark frozen points (`v0.12.0` = baseline L7, `v0.13.0` = globes, `v0.13.1` = pins, `v0.14.0` = needs tree / suppliers / map-first, `v0.14.1` = trade routes). Prefer small commits after each playable change.

## Flags (0.15.0)

Every flag in the UI comes from `src/flagDesign.ts` via `flagDesignToSvg` — never hand-draw or hardcode a flag. Rules (tested): deterministic; ≤3 tinctures (4th only with a named `justification`); charges metal/colour with contrast ≥3; adjacent fields contrast ≥1.4; daughters of different blocs never collide; or↔saffron forbidden; stars-and-stripes/ensign get at most one charge outside the canton; multinational blocs must not copy a single country's flag. Small mode is automatic at ≤30px wide (5 stripes, plain union, 6-dot ring, no specialty). Keyline #5A6B7D. Real tradition colours beat the muted UI palette. See `docs/flags.md`.

Designer review (0.15.1): Tiago's choices stand; new list rows live in `out/reports/visual-overhaul-assets.md` §12 — list only, no reskin (fervor non-colour cue is the one implemented item).
