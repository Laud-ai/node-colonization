# 0.8.0 — Nation colonization spine

Keeps L2/L3/0.7.x rules. Earth blocs and Independent lieges are **nations/agents**; colonies are **cities** (same nationColor). Shared goal: raise **nation regional power** (sum of member colony RP).

## Knobs

| Knob | Default | Role |
|------|---------|------|
| FOUNDING_COOLDOWN_TURNS | **3** | At most 1 successful found every 3 turns (G.lastFoundTurn) |
| MOON_SOFT_CAP | **4** | Moon under 4 → Moon only; else Mars allowed |
| SOLAR_BLOC_COOLDOWN_TURNS | **3** | Solar-bloc founding cooldown (G.lastSolarBlocTurn) |
| SOLAR_BLOC_AFFINITY | **2** | Culture+ideology affinity to form/join |
| SOLAR_BLOC_MIN_FERVOR | **2** | Auto opt-in fervor for extra joiners |

## 1) Nation identity + UI
- Stable nationColor per Earth bloc; Independent from liegeId hash.
- Snapshot nationRp + leading-nation hint; UI borders/badges.

## 2) Founding throttle + feed
- Cooldown 3 turns; Moon soft-cap 4; sibling feed export or underfed.
- Independent autoAct when cooldown + surplus.

## 3) Reach-aware lend + Needs-before-pass
- Reach check before lend; max 1 lend attempt/turn.
- Never pass if Needs sourcable; prefer switch; prefer intra-nation.

## 4) Vital routes
- Tag vital before route applies; rare blackmail cut; UI vital badge.

## 5) Bloc drift retune
- Apply at pressure >= 1; West/East to Neutral; Neutral to camp; log shifts.

## 6) Solar blocs
- Affinity>=2 + shared route; highest RP liege; joiners Independent+liegeId.
- Name from culture root; lastSolarBlocTurn cooldown.

## 7) Unfair extraction fervor
- Export while missing basals +fervor; cancel vital intra-nation +fervor.

## Sim (seed 42, 40 turns)
Colony count: **13**

## Gaps later
Victory condition; player bargain UI; mechanical feed; solar-bloc tune.
