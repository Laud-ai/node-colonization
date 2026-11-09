# 0.9.0 — L4 Survival & military

Keeps 0.8.3 affinity≥2 trade / fervor ledger / Trojan send / bilateral / nation spine.

## Independence threshold (editable)

- `G.independenceThreshold` (default **5**, same as `FERVOR_THRESHOLD`).
- Session: `setIndependenceThreshold` / snapshot field; UI number input in header.
- Revolt when fervor ledger sum ≥ threshold (subjects only).

## Survival clocks + Health

- Per colony: `foodClock`, `waterClock`, `oxygenClock` (oxygen only if body **not** livable).
- Tick in `afterColonyAction` when `strainOf > 0` and that basal missing (`extras` / specialty covers).
- **Health** ≡ Stability extras ≥ 1 (or specialty Stability): clocks advance only on **odd** turns (every other turn).
- At clock ≥ 3: refugee event, reset that clock.
- UI shows clocks on colony list/detail when > 0.

## Refugees

1. Reduce Population developed/import, else `populationStress++`.
2. Host priority: same-body with Food/Water extras → any willing → if body livable, Independent Resources found (cooldown 2) → else stranded log.
3. Same nation/bloc: auto-accept if free logistics.
4. Cross-nation: accept if `socialAffinity ≥ 2` and free logistics; else refuse.
5. Accept appends refugee culture tags if new.

## Military invasion (Tiago)

- Military extras = **invasion token** (developed / import / specialty unless `militaryTokenBurned`).
- Inherent `stationedDefense = 1` is flavor only (not a node); combat uses raw RP.
- `invade(attacker, defender)`: needs token; **cross-nation only**; **same body** (v1).
- Resolution:
  1. Destroy one defender **developed** node (Infra → Energy → Resources → Logistics → Production → Food → Water, then any).
  2. Higher `rp` wins; **tie → defender**.
  3. Invader wins: flip defender `patron` / `liegeId` to victor’s nation; replace `ideology[0]` with victor’s governing ideology; nation color follows.
  4. Defender wins: burn 1 Military from attacker (developed → import → specialty flag).
- West subject vs East subject raises Earth threat track 0..3; at 3 log stand-down and block further West↔East invade until decay −1/turn.
- Independents fight without Earth threat.
- `listMoves` + UI Invade button; autoAct ~8% when token + hostile same-body target.

## TF livable

- `bodyTF[body] ≥ 10` → livable: skip oxygen clocks; refugees may found Independent Resources on that body.

## Sim seed 42 × 40

| Metric | 0.8.3 | 0.9.0 |
|--------|-------|-------|
| Colonies | 29 | **30** |
| Moon / Mars | 23 / 6 | **22 / 8** |
| Revolutions | 4 | **6** |
| Invasions / annexes | — | **3 / 3** |
| Refugee events | — | **150** (many stranded early — clocks tick while strained+missing basals; hosts need free logistics) |
| Body TF Moon/Mars | — | **4 / 0** (not yet livable) |

Health ≡ Stability extras. Invade destroy-then-RP (tie → defender).

## Tests

- Threshold edit changes revolt gate.
- Clocks → refugee at 3.
- Invade RP win flips ideology + patron; lose burns Military.
- Neutral / affinity≥2 trade rules untouched (0.8.3 suite).
