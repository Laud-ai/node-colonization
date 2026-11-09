# L5 — Projects, Thrust & Map (DRAFT build brief, not authoritative)

Status: **draft for Tiago's review** (2026-10-20). Based on PLAN-L3.md, PLAN-L4.md and NOTES-0.3.0…0.9.3.md. Tiago's hand-play rules win wherever they conflict with this draft. Anything marked **❓ OPEN** still needs his decision; it is not a settled rule.

Ladder: **L5 Projects / Thrust / map** → L6 presentation & flags → L7 T3 geopolitics.

## Already shipped (do not rebuild)
- `Thrust` and `Projects` exist as NodeTypes (nodes.ts / types.ts) but have no rules yet. Thrust shows up as an Earth nation spontaneous-tech preference (SpaceX, Russia) and as the specialty flavor "Transit" (0.7.2).
- Bodies: Moon / Mars only. Mars founding is gated (`canFoundMars`, strong lunar basis / lunar ally feed). Mars needs Earth-reach logistics (0.8.1).
- `bodyTF` per body. TF ≥ 10 means livable (L4).
- Routes use logistics lines. Survival clocks, refugees, invasion and fervor presets are in place (0.9.x).
- L3 deferred "Projects-as-rule-changers" and "Thrust gates" to here. L4 deferred Projects/Thrust to L5.

## Goal
Make **distance and reach** a real constraint (Thrust and the map), and give late colonies a way to **change the rules** (Projects). That gives solar hegemons a concrete route to outgrowing Earth, which ties into the long-run independence goal.

## L5.1 — Thrust (reach gate)
Proposal: Thrust capacity decides which bodies or regions a colony can found on, route to, or invade.
- Today, Mars reach comes from Earth-sourced Logistics. Draft idea: Thrust **adds** an alternative Mars reach source that doesn't depend on Earth.
- ❓ OPEN: Does Thrust replace Earth-reach logistics, add to it, or only gate new bodies beyond Mars?
- ❓ OPEN: Is Thrust consumed per action (fuel) or a standing capacity (developed extras)?
- ❓ OPEN: Does Thrust allow cross-body routes and invasions? (Invade is same-body only in v1.)
- ❓ OPEN: Do Earth nations with a Thrust tech preference get an early bonus?

## L5.2 — Map
- Proposal: a small set of locations beyond Moon and Mars, each with bodyMod, livable flag and TF track. Candidates: asteroid belt / Ceres, Phobos/Deimos, Venus orbit.
- Simple distance tiers (Earth → Moon 1, Mars 2, beyond 3), compared against Thrust.
- ❓ OPEN: Which bodies, and how many? Fixed or seeded?
- ❓ OPEN: Do regions within a body matter (adjacency for invasions or refugees), or only bodies?
- ❓ OPEN: Is the map a UI view only in L5, with the visual polish left to L6?

## L5.3 — Projects (rule-changers)
Proposal: Projects is a long, multi-turn build that a colony (or bloc) commits extras to. Finishing one flips a game rule for its owner or its body.
- Example candidates only, not settled: mass driver (cheap Moon export), orbital shipyard (+Thrust), terraforming megaproject (+bodyTF), Earth-independent supply chain (removes the Earth-reach need, which matters for the hegemony arc), and a bloc capital that strengthens a solar bloc.
- ❓ OPEN: What does a Project cost (which node types, how many turns), and can allies chip in through routes or lends?
- ❓ OPEN: Can a Project be invaded or sabotaged (Military / Trojan)?
- ❓ OPEN: Should Projects add fervor ("we built this ourselves") or loyalty?
- ❓ OPEN: Is there one project per colony, or a global list?

## L5.4 — Auto-policy & sim
- Teach the AI policy to value Thrust and Projects. Add a headless sweep (same pattern as `sim:fervor` / `sim:solar`) with presets for project cost and Thrust strictness, plus a third tab in the setup lobby.

## L5.5 — Feel gate
- Early game: Earth-dependent and Moon-centric, with Mars hard to reach.
- Mid game: Thrust opens Mars on its own terms and Neutral drift has started.
- Late game: Projects let solar powers cut Earth reliance, so revolts and new blocs pick up.
- Before tuning, check the balance-0.9.3 refugee volume (~10/turn at T150; see out/reports/balance-0.9.3.md).

## Out of L5
L6: presentation, flags, nation colors/visual map polish. L7: T3 geopolitics (Earth proxy wars, deep diplomacy). Also deferred: scored victory, full raider economy.

## Suggested ship order
0.10.0 Thrust reach → 0.10.1 map/bodies → 0.10.2 Projects → 0.10.3 auto-policy + sweep + lobby tab → playtest gate.
