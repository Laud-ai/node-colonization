# 0.7.0 — L3 Identity & soft power (full)

Implements PLAN-L3.md with Tiago defaults for open knobs (2026-09-19).

## Open knobs (defaults)

| Knob | Default |
|------|---------|
| Fervor threshold | **3** |
| QoL missing-basal bump | **+1 each, capped +2 per tick** |
| Oxygen as basal for QoL | **Yes** — with Resources, Infrastructure, Energy, Food, Water |
| Revolution severance | **Same former Earth patron only** (not whole West/East alliance) |
| Independent founding cost | **Remove one free non-borrowed non-base logistics line** (prefer import → develop → specialty). If only base remains → cannot found |

## Model

- `patron: string` — Earth bloc name **or** `"Independent"`
- `liegeId: string | null` — Independent network root colony id (`self` for revolter/founder); `null` for Earth subjects
- `fervor: number` — subjects only; Independents skip ticks
- **socialAffinity bloc +1** if same Earth patron **or** (both Independent and same `liegeId`)

## A. Fervor (L3.2)

Subjects only (`patron !== "Independent"`). Ticked via `afterColonyAction` at end of successful moves, pass, autoAct, and finishTurn auto-passes.

**Drivers (per tick):**
- Cultural misalignment vs patron Earth culture tag → +1
- Ideological misalignment vs patron governing ideology → +1
- Missing basal (extras=0) among {Resources, Infrastructure, Energy, Food, Water, Oxygen} → +1 each, **cap +2**
- Not importing from patron Earth / same-patron colonies → +1
- Exit safety high (≤1 severable link AND ≥4 basals local) → +1
- If **heavily** on sovereign network (importing + ≥3 severable links): suppress dependence/exit gains this tick
- Developed Subversion + strain ≥ 2 → +1 mild
- Subversion route start → +1 (immediate)

**Decay:** aligned culture+ideology AND importing from patron network AND ≤1 missing basal → fervor −1 (floor 0).

**UI:** fervor on subject colony cards / detail.

## B. Revolution (L3.3)

When fervor ≥ 3 after a tick → `independenceScore` (vibe-matching):
- Push Independent: misalignment, missing basals, low dependence, high exit safety, fervor
- Push stay: alignment, patron-network imports, low exit safety / many severable links

If score > 0:
1. Sever routes / claims / lends / borrowed lines with **former Earth patron** and colonies still under that patron
2. Release Earth claims + reroll
3. `patron = "Independent"`, `liegeId = c.id`, `fervor = 0`
4. Revolution log + turn announcement

Helpers: `wouldSeverOnRevolution`, `wouldSeverEarthBloc`, `executeRevolution`, `severableLinkCount`.

## C. Independent founding (L3.3)

Any `patron === "Independent"` colony with ≥1 free non-base own logistics line may `found-colony`:
- Pay: remove that line
- New colony: Moon if &lt;5 else Mars; random specialty/requires; culture/ideology from founder; `patron=Independent`, `liegeId = founder.liegeId ?? founder.id`
- Earth `tryFound` / founding tax unchanged

## D. Trojan Subversion (L3.4)

- Undetectable (`route.trojan` / `line.trojanExport`; no Stability roll)
- Enemy-only: `socialAffinity === 0` and not same bloc
- Attacker: Subversion extras + free logistics line + excess of visible node
- Victim accepts only if node fixes Requires / critical missing basal / strained dep **and** no Earth/ally/affinity≥1 source (`trojanAcceptanceGate`)
- On success: victim gets clean import of visible node; attacker line occupied with Trojan payload; +1 fervor on subject victim
- Rare in `listMoves` (cap 3); `autoAct` only when stranded victim exists

## E. Auto-policy (L3.5)

Needs → deps → lend/switch first. Then Independent may found if surplus (RP≥2, strain≤1). Trojan last. Subjects refuse enemy Subversion unless desperation gate.

## F. Soft-power polish (L3.1 thin)

Trade/lend move cards always show `Affinity N`.

## Out of scope

Wars, refugees, combat, threat tracks (L4+).

## Files

- `src/l3.ts` — fervor / revolution / Independent founding / Trojan
- `src/engine.ts` — wiring, moves, autoAct, affinity bloc
- `src/types.ts` — `fervor`, `liegeId`, trojan flags
- `NOTES-0.7.0.md`, README L3 section; `PLAN-L3.md` kept

## Balance notes (first ship)

- **Not-dependent / exit-safety fervor** only apply when `localBasalCoverage >= 2` (prevents turn-1 melt from “missing everything + no imports”).
- **Revolution hard gate:** `exitSafetyHigh` OR (not on patron network AND ≥3 local basals). Independence score alone is not enough while fragile.
- Missing-basal score contribution capped at +2; low exit safety + many missing basals biases **stay**.
