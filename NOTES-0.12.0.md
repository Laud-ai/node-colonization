# 0.12.0 — L7: T3 geopolitics (proxy wars + solar hegemon overturn)

Rules tab, group "L7 Geopolitics". Legacy turns these off.

## Proxy wars (`l7Proxy`, threshold `l7ProxyThreat` = 1)
- When the West↔East Earth threat track reaches the threshold, each camp agitates one random subject colony of the rival camp every turn: `proxyAgitation` +2 (cap 4), decaying by 1 per turn. Agitation counts in the fervor ledger.
- In sims the threat track rarely rises (proxy events 0–4 per 150 turns), so this is a mid-game spice, not a driver.

## Overturn (`l7Overturn`, `l7OverturnMinTurn` 90, `l7OverturnRatio` 3)
- From T90, at most once per 15 turns: the strongest Independent liege group (3 or more member colonies) checks for an Earth patron that still has 2 or more colonies and whose colony RP is at most 1/3 of the liege's. If it finds one, it absorbs that patron's whole empire: every colony revolts and takes the hegemon as liege. Logged as `👑 OVERTURN`.

## Fervor ledger hook
- `src/fervorHooks.ts` adds the L5 Supply Chain fervor and the L7 proxy agitation to the ledger. This fixes 0.10.0, where the Supply Chain bonus was overwritten when the ledger was recomputed.

## Sim (`npm run sim:growth -- 150 42,7,99`)
Overturns: T117 / T96, T126 / T103, T125. First revolt T45–48. Independent at T150: 16/19, 20/21, 20/22 (a long-run majority). Colonies at T40: 11; at T150: 19–22. Refugees 0.28–0.40 per turn.

## Decisions (decided by Space Game, Tiago may override)
- An overturn takes the Earth nation's colonies but leaves the Earth bloc itself in play (it can still found new colonies). It isn't a game-over and there is no scored victory.
- Deep diplomacy (treaties, bargaining screen) is deferred. Proxy agitation is the only Earth-side lever for now.
- Overturn needs a real empire on both sides: the hegemon has 3 or more colonies and the target has 2 or more. Single loyal stragglers stay with Earth.
