# 0.7.2 — Corporate cyberpunk cultures, culture-forward names, editable labels

Keeps 0.7.1 trade gates / two-way logistics / reach / alliance and L3 intact.

## A) Corporate cultures & ideologies

| Bloc | Culture | Ideology |
|------|---------|----------|
| **SpaceX** | **Corporate American** (not plain American) | **Corporate Pioneerism** — corporatist cyberpunk US / orbital market-state flavor |
| **Corporate China** | **Corporate Chinese** | **Platform Socialism** — corporatist PRC platform-state flavor |
| Nation-state blocs | Classic (American, Chinese, European, …) | Unchanged governing ideologies |

- `NATION_ADJ.SpaceX` = `Corporate American` — colony titles never use bare `"SpaceX"`.
- West/East camp sets in `trade.ts` include the new culture/ideology tags (affinity & alliance pressure still work).

## B) Colony name generation (culture-forward)

Replaces flat `{NationAdj} {Specialty} {BodyAdj}`.

**Pattern:** `{Culture} {SpecialtyFlavor} {BodyAdj}` + ~35% optional `(IdeologyHint)` + collision serial.

Examples:

- `Corporate American Transit Lunar`
- `Chinese Extraction Martian (Pioneer)`
- `Corporate Chinese Influence Lunar`
- `American Atmo Lunar` (seed 42 US starter)

Specialty flavor map (`SPECIALTY_FLAVOR`): Resources→Extraction, Military→Garrison, Thrust→Transit, Subversion→Influence, Logistics→Haul, Oxygen→Atmo, …

Ideology hints (`IDEOLOGY_NAME_HINT`): Corporate Pioneerism→Pioneer, Platform Socialism→Platform, Democratic Free Market→Market, …

- Deterministic from seed RNG (`chance` for ideology suffix) + `nameSerial` collision (` 2`, ` 3`, …).
- Independent founding uses founder’s primary culture + specialty + ideology the same way.

## C) Editable names

Session / engine API:

- `renameColony(id, name)`
- `renameCulture(colonyId, index, label)`
- `renameIdeology(colonyId, index, label)`
- `renameIdeologyImported(colonyId, index, label)`

Validation: trim, non-empty, max **48** chars; colony names uniquified with serial on clash.

UI (colony detail): contenteditable colony name + culture / ideology / imported-ideology chips; Enter or blur commits; Escape cancels. Light log on rename. `socialAffinity` uses current tag strings (player owns the fiction). Earth bloc names stay fixed.

## Files

- `src/engine.ts` — CULTURES / IDEOLOGIES / NATION_ADJ / SPECIALTY_FLAVOR / nextColonyName / rename*
- `src/trade.ts` — camp sets
- `src/session.ts` / `src/ui/main.ts` / `src/ui/style.css` — API + edit UI
- `NOTES-0.7.2.md`, README bullets
