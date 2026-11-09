# 0.7.3 — Evocative modular colony names

Keeps 0.7.2 Corporate American / Corporate Chinese cultures & ideologies and all editable rename APIs.

## What changed

Replaces the dry `{Culture} {SpecialtyFlavor} {Body}` generator (e.g. `Corporate American Transit Lunar`) with **seeded modular Solar Realist names** that feel like hand-sim playtest fiction.

- American: Fort Armstrong, Pioneer Outpost *(feel only — not hardcoded)*
- Chinese: Guanghan Lunar Research Station, Nüwa Lunar Terraforming Colony, Huaxia Heritage Colony
- Russian: Baza Korolyova

## `src/naming.ts`

Culture banks keyed by family (American, Corporate American, Chinese, Corporate Chinese, Russian, European, African, Latin, Caliphate, South Asian, East Asian, Indochinese, British, UN, Independent, Mixed):

| Pool | Role |
|------|------|
| `roots[]` | Myth / hero / virtue / place stems (Armstrong-like, Nüwa-like, Korolyov-like, … + many alternatives) |
| `prefixes[]` | Fort, Baza, Port, New, … (culture-appropriate) |
| `corpPrefixes[]` | Omni-, Helix-, Apex-, Platform-, … for corp families |
| `SPECIALTY_TERMS` | Research, Extraction, Terraforming, Heritage, Garrison, Haul, Atmo, Influence, Foundry, … |
| ideology hints | Pioneer, Heritage, Socialist, Market, Technate, Situationist-feel — ~25% |
| `BODY_TERMS` | Lunar, Martian, Moon, Mars, of the Moon, … |
| `SUFFIXES` | Colony, Outpost, Settlement, Station, Base, Hab, Works — ~50% |

### Templates

1. `{Prefix?} {Root} {Suffix?}` — Fort Armstrong / Pioneer Outpost / Baza Korolyova
2. `{Root} {Body?} {Specialty} {Suffix}` — Guanghan Lunar Research Station
3. `{Root} {Specialty} {Suffix?}` — Huaxia Heritage Colony
4. `{Root} {IdeologyHint?} {Suffix?}` — lighter ideology
5. Corporate: `{CorpPrefix}{Root} {Specialty?} {Suffix?}`

Weights: root always; specialty ~70%; body ~40%; ideology ~25%; suffix ~50%. Avoids ugly doubles. Collisions append `II` / `2` / `Beta` sparingly.

Independent founding uses founder `culture[0]` bank (via `makeColony` → `nextColonyName`). SpaceX still maps to **Corporate American** (never bare "SpaceX" in titles).

## Unchanged

- `renameColony` / `renameCulture` / `renameIdeology` / `renameIdeologyImported`
- CULTURES / IDEOLOGIES / NATION_ADJ corp tags
- Trade gates, L3, logistics reach

## Files

- `src/naming.ts` (new)
- `src/engine.ts` — re-exports naming; `makeColony` passes patron
- `tests/determinism.test.ts` — evocative uniqueness / diversity / soft prefix-suffix asserts
- `NOTES-0.7.3.md`, README, `package.json` → 0.7.3
