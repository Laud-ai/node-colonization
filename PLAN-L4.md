# L4 — Survival & military (build brief)

Authoritative Tiago clarifications (2026-09-19).

## Scope
Survival clocks, refugees, Health slowing clocks, Military invasion token, thin threat track, TF livable light, **editable independence fervor threshold**.

Defer: full raider economy, Leadership/Commerce deep, Earth proxy wars, Projects/Thrust (L5), scored victory.

## Independence threshold
- Game setting `independenceThreshold` (default 5 from 0.8.3).
- Editable in UI (number input) + session API; used by fervor revolt check.

## Survival
- foodClock / waterClock (+ oxygenClock if body not livable): +1 when strained and that basal missing (specialty covers).
- Health extras ≥ 1: clocks tick every other turn.
- At clock ≥ 3: emit refugees, reset clock.

## Refugees
- Destination priority: same-body with Food/Water → any willing → if livable body Independent found → else log stranded.
- Same-nation may auto-accept; others choose; acceptance can append culture.
- Refusal if no logistics.

## Military (Tiago)
- Military extras = **invasion token**, apart from inherent local defense (defense = 1, stays home).
- **Invade** action (needs Military token, valid target — prefer cross-nation; same-color optional refuse or allow with threat):
  1. Destroy one defender node (basal priority: Infra, Energy, Resources, Logistics, Production, Food, Water).
  2. Compare **RP attacker vs RP defender** (roll/tie → defender wins, or higher RP wins; document).
  3. **Invader wins:** defender ideology + bloc/patron (and liege as needed) flip to victor’s; nation color follows.
  4. **Defender wins:** attacker’s Military node/extra destroyed (lose the token).

## Threat track
- Cross West/East subject combat raises threat 0–3; at 3 stand down or allow war label.
- Independents fight without Earth threat.

## TF livable
- bodyTF ≥ 10 → livable: Oxygen clock off; refugees may found Independent on body.

## Status
Implemented in **0.9.0** (`NOTES-0.9.0.md`). Health cover uses **Stability** extras. Invade same-body + cross-nation only for v1.
