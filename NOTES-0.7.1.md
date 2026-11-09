# 0.7.1 — Playtest trade gates, two-way logistics, reach, social blocs

Keeps L3 (fervor / revolution / Independent founding / Trojan) intact.

## 1) East / West Earth trade — vital + fair only

- Colony under **West** Earth patron cannot freely import from **East** Earth blocs (and vice versa).
- **Neutral** patrons may trade with anyone.
- **Neutral** Earth is always legal.
- **Independents:** Earth trade allowed with **Neutral**, or East/West when `earthBlocSocialAffinity` (culture/ideology tags vs that bloc) ≥ 1, else only via vital+fair. East↔West still gated the same way.
- **Exception — vital + fair** (opposite / non-affinity Independent → East/West):
  1. **Vital:** node is `requires`, OR missing basal (Resources/Infra/Energy/Food/Water/Oxygen), OR missing dep of a strained developed node.
  2. **No friendly alternative:** no same-alliance Earth, Neutral Earth, Independent-affinity Earth, same-patron colony, or colony with `socialAffinity ≥ 1` offers that node.
  3. **Fair:** opposite excess is free **and** actor already has **&lt; 1** opposite-alliance Earth route / Earth-sourced Logistics import (`MAX_OPPOSITE_EARTH_ROUTES = 1` — at most one opposite route at a time).
- Enforced in `earthTradeAllowed` → `findSources` / `listMoves` / `validateTradeSource` / auto-policy (not ranking alone).
- Ranking: same-alliance / Neutral Earth best; opposite vital+fair worst among Earth.

## 2) Logistics = two-way street

- Each open line: **1 import** (`route`) + **1 export** (`exportRoute`) simultaneously.
- **Open** = not `lentTo` (lent-away locks **both** slots for the owner). Own lines with an import can still export if `exportRoute` empty (and vice versa).
- Colony A ← B: uses A’s import slot **and** B’s export slot (same reach rules).
- Earth → colony: only actor import slot (Earth has its own excess slots).
- `freeLines` / new import: `route === null && !lentTo` (export may be set).
- Export capacity: `exportRoute == null && !lentTo && !trojanExport && kind !== "borrowed"`.
- Lend requires both slots empty; borrowed lines inherit lender `reach`.
- Trojan occupies attacker **export** slot (`trojanExport` + `exportRoute.trojan`).
- Importing Logistics still **adds** a line (and claims exporter export if colony-sourced).

## 3) Distance / logistics reach

Line `reach` from origin:

| Reach | Serves | Does not |
|-------|--------|----------|
| **earth** (imported from Earth) | Earth↔Moon; Earth→Mars if line is on Mars | Moon↔Mars |
| **moon** (Moon base/develop/specialty) | Earth↔Moon, Moon↔Mars, Moon-local | — |
| **mars** (Mars body lines) | Moon↔Mars, Mars-local | Earth↔Moon / Earth imports |

- Mars cannot import from Earth unless it has an **Earth-sourced** logistics line.
- `lineCanServeTrade(line, actor, source)` filters moves.

## 4) Social development shifts blocs

- Earth `alliance` is **mutable**.
- After Culture/Ideology develop (forced check) and each `finishTurn` (hysteresis): subject ideology/culture camps (West vs East tag sets) + fervor/culture mismatch → pressure.
- Soften **West/East → Neutral** first; Neutral → West/East only with strong majority cluster.
- Need **2 consecutive** turn signals (develop checks use `force` and apply when pressure is present).
- `socialAffinity` bloc +1: same Earth **alliance** (after shifts) **or** Independent same `liegeId`.

## 5) UI — Solar independents

- Panel **below** Earth blocs: Independent networks grouped by `liegeId` (liege name, members, count, total RP).
- Logistics UI shows In/Out legs + reach tag.
- Snapshot: `independentGroups`.

## Files

- `src/trade.ts` — vital+fair, reach, alliance pressure
- `src/types.ts` — `exportRoute`, `LineReach`, `alliancePressure`
- `src/engine.ts` / `nodes.ts` / `l3.ts` / `session.ts` / UI
- `NOTES-0.7.1.md`, README bullets
