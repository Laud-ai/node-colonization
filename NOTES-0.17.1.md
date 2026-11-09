# 0.17.1 — Fewer passes: RP turn order, develops spread to smaller colonies, colonies work Earth

Tiago: "there is still a lot of passing. Turn order is in reverse, it should be from highest RP to lowest but with the AI prioritizing colony development opportunities even at lower level colonies rather than letting the biggest colony have it all … The colonies should either be actively cycling earth nodes or cooperating to unlock more earth nodes in their sovereign or allies."

## Diagnosis (0.17.0 rules, seeds 42, 7, 99, 123, 5 × 120 turns, `npm run sim:passes`)
- **73% of colony actions were passes** (5,758 / 7,853), rising from 58% (turns 1–30) to 79% (turns 91–120). L1 colonies passed 86% of the time.
- **Turn order really was reversed-looking:** colonies acted hungriest-first (need score), RP only broke ties. The top-RP colony acted first in only 10% of turns.
- **Why they passed:** in 98% of passes the colony had **no free logistics line** (its lines lent away, or carrying vital imports), so it couldn't cycle Earth either. Its Requires usually existed somewhere (90% of passes) but the colonies holding it had no free export slot — their lines were lent/borrowed, exporting vital goods, or importing from Earth (which blocks exporting on that line).
- **Big colonies had it all:** small colonies lent their only line to bigger ones; most exports flowed to L11+ colonies.
- Unused at pass: importing Earth Logistics for a new line was possible in 28% of passes; nobody did it.

## What changed (three rules in the new "AI" group; all on; off = 0.17.0 AI)
- `aiTurnOrderRp`: highest RP acts first (ties: hungrier, then name).
- `aiSpreadDevelop` (gap 3 levels): a colony ≥3 levels above a friend (same nation, or same West/East alliance) that hasn't acted yet leaves it their shared Requires source; first feeds a smaller friend's Requires from its own surplus; never borrows a line from a much smaller colony; a small colony takes back a line it lent to a much bigger one (if used for something non-vital) to develop.
- `aiActiveEarth`: before passing, a colony imports Logistics from Earth (or its own nation) for a new line, moves a non-vital route onto an unclaimed slot of its own/allied/Neutral Earth bloc closest to filling (a full bloc unlocks a new excess), or feeds a friend's Requires. Passes only when none is possible.
- No game rules changed.

## Before / after
| | 0.17.0 | 0.17.1 |
|---|---|---|
| Pass rate | 73.3% | 33.4% |
| L1 pass rate | 86% | 72% |
| Top-RP colony acts first | 10% of turns | 100% |
| Develops / seed | 106 | 437 |
| Develops per action — L1 / L2-3 / L4-6 / L7-10 / L11+ | 3% / 6% / 7% / 12% / 16% | 8% / 14% / 23% / 25% / 48% |
| Develop Gini across colonies | 0.56 | 0.42 |
| Top colony's share of develops | 22.7% | 15.6% |
| Earth cycles / seed | 37 | 34 |
| Earth unlocks (new excess) / seed | 50 | 89 |
| Revolutions (total) | 54 | 43 |
| Colonies at T120 | 19.2 | 16.6 |
| Refugee waves / O₂ deaths (`sim:clocks`) | 12 / 15 | 52 / 18 |
