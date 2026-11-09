# 0.6.1 — Oxygen, social assist affinity, lend polish

## A. Oxygen node
- New developable / importable node: **Oxygen**.
- Placement: after Water in `NODES` (life-support cluster).
- `DEPS.Oxygen = ["Infrastructure"]` only.
- Population deps stay **Food + Water** (Oxygen is independent).
- Color: `#67e8f9`. Random mode already samples the full `NODES` list.

## B. Social assist affinity (authoritative)
Helper: `socialAffinity(a, b): number` — sum **0–3**:
| Point | Rule |
|-------|------|
| **bloc** (+1) | same `patron` |
| **culture** (+1) | any shared tag in `culture[]` |
| **ideology** (+1) | any shared tag in `ideology[] ∪ ideologyImported[]` |

**Consent / assist (export & lend):**
- Same patron: always OK.
- `socialAffinity >= 1`: export / lend OK.
- Affinity 0 + generous surplus (`extras >= 2`): weak commercial export only (no lend).
- Replaces the old crude same-alliance / `extras>=2` cross-alliance dump as the primary assist rule.

**Trade source ranking (`rankSource` / `pickBestSource`):**
- Earth same-alliance still best (rank 0), other Earth next (1).
- Colony sources ranked by affinity: higher affinity preferred (e.g. ideology+culture = 2 beats bloc-only = 1).

Examples: bloc only → **1**; shared ideology+culture (different patrons) → **2**.

## C. Lend polish
When an actor has **no free logistics line** but needs a normal (non-Logistics) import:
1. Pick highest-`socialAffinity` assisting colony (`affinity >= 1`) with a free non-lent line.
2. Set lender line `lentTo = borrower.id` (lent lines do **not** count toward RP).
3. Attach a temporary `kind: "borrowed"` line on the borrower named `via [Ally] Logistics`.
4. Borrower runs the import on that borrowed line.
5. On cancel (or idle cleanup at end of turn): clear `lentTo` and remove the borrowed line.

`listMoves` exposes `start-lend` moves; `autoAct` uses lend when it unblocks Requires / deps.

## D. Auto-policy priority
1. Fill **Requires** (start / lend+import / import Logistics).
2. Cover **missing deps of Requires**, then strained developed nodes.
3. Prefer higher `socialAffinity` sources; Earth same-alliance over weak colony.
4. Switch routes before pointless pass when that fills Needs.
5. Founding tax / US–China uncapped rules unchanged from 0.6.0.

## Packaging
- Version **0.6.1**. Requires remain fully random.
