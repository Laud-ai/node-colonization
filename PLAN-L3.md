# L3 — Identity & soft power (build brief)

Authoritative clarifications from Tiago (2026-09-19). Hand-play vibe beats older formalizations where they conflict.

## Already shipped (do not rebuild)
- Ideology / culture permanence, coexist / overwrite / blend (0.6.0)
- `socialAffinity` bloc/culture/ideology = 1 each → consent, trade rank, lend (0.6.1)
- Oxygen node (Infrastructure dep)

## Goal
Soft power makes Earth hegemony fragile. Colonies revolt for **recognizable** reasons: misalignment with the ruler, bad quality of life, and **not** needing the founder’s network. Independence is a **revolution**, not a polite paperwork change.

## Out of L3 (L4+)
Wars, threat tracks, combat, refugees, food/water clocks as survival systems, Projects-as-rule-changers, Thrust gates, scored victory.

---

## L3.1 — Soft-power polish (optional / thin)
Affinity already carries friendship. Only add UI clarity (show affinity on colony trade/lend) and tiny RP/consent nips if play still feels flat. Skip if L3.2–3.4 are enough.

---

## L3.2 — Fervor track (subjects only)

`fervor` starts at 0. Independent colonies do not accumulate subject-fervor.

### Drivers (real-life revolt → mechanics)
Each check (end of colony action or end of turn — pick one and keep it stable):

| Vibe | Mechanic (suggested balance) |
|------|------------------------------|
| Cultural misalignment with ruler | +1 if `culture` does not include patron’s culture tag (or culture[0] ≠ patron culture) |
| Ideological misalignment | +1 if no shared ideology with patron’s default / governing ideology |
| Failing QoL / missing nodes | +1 per **missing basal** among {Resources, Infrastructure, Energy, Food, Water, Oxygen?} with extras = 0 (and specialty does not cover). Cap this bump (e.g. max +2/turn) so early random Requires don’t explode |
| Not dependent on founder | +1 if the colony currently has **no** active import route from its patron Earth bloc **and** no route from same-patron colonies |
| Can leave without harm | +1 (or +2) if **exit safety** is high: few/no active routes that would be severed on revolution (see L3.3), and basal coverage is mostly local/clean. Inverse: if heavily wired into sovereign network, **suppress** fervor gain this tick (0 from dependence/exit terms) |

Subversion import: +1 fervor when a Subversion route starts (or when Trojan lands — L3.4). Developed Subversion while strained: optional small +1 if strain ≥ 2 (keep mild).

**Decay / pressure valve:** if aligned with patron (culture + ideology) **and** importing from patron network **and** basal mostly covered → fervor −1 (floor 0). Prevents inevitable breakaways when the colony is a healthy subject.

**UI:** fervor on colony card / detail for subjects.

---

## L3.3 — Independence = revolution

### Test
When `fervor ≥ threshold` (start at **3**, tune in playtest): run independence score.

Prefer a score that **matches the vibe**, not opaque math:
- Push toward Independent: high fervor, missing basals, misalignment, **low** dependence on founder network, **high** exit safety (can cut links without collapsing).
- Push toward stay subject: alignment, active patron/same-patron imports, low exit safety (revolution would trash needed routes), relative RP still sheltered by patron family.

If score says Independent:
1. `patron = "Independent"` (or equivalent); fervor → 0.
2. **Revolution severance:** cancel **all** routes / claims / lends / borrowed lines linking this colony to:
   - the former Earth sovereign (patron bloc), and
   - **sovereign-aligned** colonies (same former patron; optionally same Earth alliance — default: **same former patron only**, tune if West/East bloc rupture feels right later).
3. Earth slots claimed by the revolter on that sovereign are released + reroll as normal cancel.
4. Log a clear revolution banner.

Balance: severance is the cost of freedom — a colony that still needs the network should rarely pass the “can leave without harm” fervor / score gates. A colony that already traded with culture/ideology friends outside the patron is rewarded.

### Independent as founder (new)
Independent colonies (or an “Independent” founding actor) may **found** new colonies:
- Pay a founding tax analogue (e.g. spend Logistics lines / Money / tech-like colony resource — **open**: simplest is RP or Logistics cost, or a small “colonize” action consuming free logistics + basal surplus).
- New colony starts with patron = that Independent colony’s id/name (or `Independent` bloc with founder link).
- Culture/ideology seed from founder; specialty/requires still random in random mode.
- Earth blocs keep their existing founding tax rules; Independents do **not** use Earth tech caps.

---

## L3.4 — Trojan Subversion (undetectable, hard)

- **Not detectable.** No Stability detection roll.
- **Enemy tool only:** auto-policy and legal moves only offer Trojan when `socialAffinity` is low (0, or not same patron / not friendly). Allies never Trojan allies.
- **Acceptance is desperate:** recipient accepts Trojan **only if**:
  1. The offered node fixes a **hard** issue (Requires, or strained/missing basal that is hurting), **and**
  2. No acceptable source exists from allies / higher-affinity partners / same-bloc / Earth friends, **and**
  3. Optionally: strain above a threshold or fervor already rising.
- Setup cost on attacker: spend a free logistics line **and** have Subversion excess (or Subversion specialty); maybe consume the Subversion export as the hidden payload while the visible node is what the victim “bought.”
- On accept: victim gets the visible node clean (or as normal import); **+1 fervor**; attacker’s Subversion intent succeeds silently.
- Balance target: Trojans are rare in sims; they show up when someone is stranded without friends.

---

## L3.5 — Auto-policy + sim
1. Needs / deps / lend (existing) first.
2. Subjects: never seek Subversion from enemies unless stranded (same desperation gate as Trojan accept).
3. Rivals: may attempt Trojan only when victim looks desperate and affinity is hostile/zero.
4. Founding: Earth tax unchanged; Independents may found when they have surplus + low strain.
5. Headless: occasional revolutions mid-game without early-game melt; Trojans uncommon.

---

## L3.6 — Feel gate
- Healthy aligned subjects stay calm.
- Misaligned, undersupplied, founder-independent colonies heat up and can cut the cord.
- Revolution hurts if you were still on the sovereign drip — leaving “without harm” should feel earned.
- Trojans feel dirty and rare, not a default trade button.
- Independents can grow their own networks as mini-patrons.

Only then open L4 (survival / military).

---

## Suggested ship order
1. **0.7.0** — L3.2 fervor drivers + UI  
2. **0.7.1** — L3.3 revolution severance + Independent patron  
3. **0.7.2** — Independent founding  
4. **0.7.3** — L3.4 hard Trojans + auto-policy  
5. Playtest gate → L3.1 polish only if needed

## Open balances (tune with Tiago after first play)
- Exact fervor threshold (3?) and per-tick caps
- Whether Oxygen counts as basal for QoL
- Severance = same former patron only vs whole Earth alliance
- Independent founding currency (Logistics vs Money vs abstract colonize action)
