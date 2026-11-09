# 0.8.3 — Colony trade affinity ≥ 2, fervor ledger, Trojan send, bilateral trade

Keeps 0.8.2 Earth cycle / Mars gate / 1 found per turn.

## Affinity gate (colony↔colony)

`colonyTradeOk` / `consentsExport` / lend assist:

| Case | Allowed? |
|------|----------|
| Same bloc (same Earth patron or Independent same liege) | Yes |
| Either party **Neutral-patron** | Yes (Neutrals trade with everyone) |
| Same West or same East Earth alliance | Yes |
| Else (West↔East rivals, Independent↔non-Neutral, …) | Only if `socialAffinity ≥ 2` |

- Affinity 1 alone (bloc-only / culture-only across rivals) is **not** enough for West↔East.
- **Neutral Earth blocs** remain open via existing `earthTradeAllowed` (no aff≥2).
- UI: colony trade moves only appear when `findSources` passes the gate; logistics show `X ⇄ Y`.

## Fervor ledger (subjects only)

Recomputed each tick as sum of ±1 terms (Independents skip).

**+1 each:** permanent `subversionMark`; each lacking basal among {Resources, Infrastructure, Energy, Food, Water, Oxygen}; different culture from patron; different ideology from patron; `rp ≤ 1`; strain ≥ 3; unfair extraction (exporting to same-nation while ≥2 basals missing).

**−1 each:** shared culture with patron; shared ideology with patron; active trade with own bloc/liege/patron Earth; active trade with consenting aff≥2 colony partner; `rp ≥ 5`; importing vital Needs.

**Independence threshold: `FERVOR_THRESHOLD = 5`.** On revolt: same severance as before. Display may be negative (“loyal”); revolt when sum ≥ 5.

## Trojan = reverse logistics send

- Action occupies a free logistics line as `trojanSend` toward target (no trade node granted).
- Sets permanent `subversionMark` on target (+1 ledger term).
- Only vs `socialAffinity ≤ 1` and not same bloc; rare in autoAct (~10% when Subversion excess).
- Cancel frees the line; mark remains.

## Bilateral trade (one consented two-way)

- Colony import opens a bilateral deal on that line: A receives X from B.
- B may `counter-request` Y; A must consent → `X ⇄ Y` (`counterNode` / `counterConsent`; exporter gets `inboundNode`).
- Earth imports stay one-way (no Earth counter in v1).
- One line = one partner deal (no Earth-in + third-colony-out).

## Sim seed 42 × 40

| Metric | 0.8.2 | 0.8.3 |
|--------|-------|-------|
| Colonies | 29 | **29** |
| Moon / Mars | 26 / 3 | **23 / 6** |
| Revolutions | — | **4** (threshold 5) |
| Counter / ⇄ log hits | — | **22** |
| Colony import starts | — | **21** |
| Trojan sends | — | **0** (rare) |

Revolts occasional (4 on this seed; band target ~0–3). Trade patterns: Neutral Earth still preferred; rival colony trade only at aff≥2; bilateral counters appear in autoAct.

## Tests

- US↛China at aff 1; US→China at aff 2; Neutral-patron open.
- Fervor ledger + independence at threshold.
- Trojan send marks without trade node; cancel keeps mark.
- Bilateral A←X then B adds Y with consent.
- Full suite green; `tsc --noEmit` + `vite build` pass.
