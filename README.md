# Node Colonization — CORE (L0 + L1 + L2)

Seeded deterministic CORE simulation. **L0** is the headless engine; **L1** is a Vite browser UI that imports and drives the same logic.

**Version 0.9.3** — L4 survival clocks / refugees / Military invade / editable independence threshold (see NOTES-0.9.0.md). Pre-sim fervor variant lobby: NOTES-0.9.2.md. Solar-bloc timing + Diplomacy lobby tab: NOTES-0.9.3.md.

## Setup

    cd /workspace/node-colonization-l0
    npm install

## Headless (L0)

    npm run sim -- --seed 42 --turns 40
    npm test
    npm run sim:solar   # solar-bloc / diplomacy param sweep

API: import { runSim } from "./src/runSim.ts"; runSim(seed, turns);

## Browser UI (L1)

    npm run dev          #  http://0.0.0.0:5174 (port 5174 to avoid moon-globe on 5173)
    npm run build        # tsc + vite build
    npm run preview      # preview production build on 4174

Open **http://localhost:5174/** (or the host address on port 5174).

### Manual play vs Simulate N

- **Legal move cards** list currently legal imports (Take / Pass / Auto-resolve).
- **Cancel Earth trade** cards free a claimed Earth slot and specialty-reroll that excess (switch cost).
- **Lend Logistics:** when the actor has 0 Logistics, allied colonies (same patron / shared culture / shared ideology[0]) can lend — import cards show `via [Ally] Logistics`.
- **Auto-resolve** runs the L0 auto-policy once for the current actor.
- **End turn** auto-passes any not-yet-acted colonies, then founding + cleanup, then opens the next turn (Earth spontaneous). Foundings announce with a banner at the **start of the next turn**.
- **Found** calls founding (US/China always; others need tech >= cap).
- **Simulate N** finishes the current turn with auto-policy (if needed), then runs N complete L0 turns, and returns control for manual play.
- **New game…** returns to the setup lobby (fervor + Solar/Blocs tabs); seed field or random; starters are two Moon colonies (US + China patrons) with **fully random** specialty/requires and **evocative modular names** (e.g. `Fort Armstrong`, `Guanghan Lunar Research Station`, `Omni-Helix Transit Outpost`) — see 0.7.3.

## Rule corrections (0.5.0 base)

- **Earth trade slots:** each bloc starts with randomized excess + **3** slots. Import occupies a slot and claims that excess exclusively. When **all** slots are occupied, the bloc immediately develops a new excess (specialty 80% / any 20%). **Cancel** clears the claim, frees one used slot, and **rerolls** that excess from the bloc specialty pool. Claims persist until cancelled — the old MVP random 25% end-of-turn slot-free path is removed.
- **Logistics:** each colony has a base line plus optional specialty/imported/developed lines. **Logistics specialty** starts with a second free specialty line. Normal imports need a free line; **importing Logistics adds a line** (does not consume one). Allies may **lend** a logistics line (`lentTo`). See Regional Power / 0.5.3 below.
- **Earth tech / founding:** all blocs start at tech **0**. **United States** and **China** have **no founding tech cap** (always eligible). **Founding tax:** US/China pay `colonyCount` tech; others pay `2 + colonyCount` (starters already `colonies=1`). Foundings queue a next-turn announcement banner.
- **UI Earth blocs:** no tech progress bar / uncapped wording. Show alliance, slots used/cap, excess (claimed as `Node->Colony`). Eligible blocs show **"Active colonial player"**.
- **Body quality / specialty:** Moon and Mars bodyMod = 0; specialty never shows missing-deps warnings.

## CORE coverage

Nodes / deps / specialty-clean / import-clean / strain / RP; Earth blocs; exclusive claims + cancel/reroll; Logistics lend; consent trade; develop; founding Moon then Mars; procedural names; turn order spontaneous-act-found-cleanup; auto-policy prefers Requires then missing dep then pass.

Determinism via mulberry32(seed). Same seed => identical headless log.

## Game mode (0.5.1)

- **`gameMode`:** `"random"` | `"realistic"`. This build is always **`random`**.
- **Random:** Earth excess draws, cancel rerolls, colony specialty, and requires all sample uniformly from the full **NODES** list (requires ≠ specialty). `SPECIALTIES` pools are kept in code for a later realistic mode (patterned Earth / specialty pools) and are not used.
- **Naming (0.7.3):** modular `{Prefix?} {Root} {Body?} {Specialty?} {Suffix?}` from culture banks — e.g. `Fort Armstrong`, `Baza Korolyova`, `Huaxia Heritage Colony`. Collisions append ` II` / ` 2` / ` Beta`.


## Regional Power (0.5.2)

RP = `bodyMod` + specialty (always 1, except Logistics) + developed extras (non-Logistics) + active clean imports (non-Logistics) + extra logistics lines - strain + `bodyTF[body]`.

- **Do not count:** invisible baseline +1, the **base** logistics line, lent extra lines (`lentTo` set).
- **Do count:** specialty (non-Logistics); each developed non-Logistics extra; each active clean import route; each extra logistics line (specialty / imported / `logistics works`), including while that line carries a route.
- Starters with only a specialty therefore show **RP 1** (Logistics specialty via its specialty line).

## Colony level + Logistics specialty (0.5.3)

- **Level** = `1 + sum(developed extras)`. Specialty is the starting tier → fresh colony is **Level 1**; each develop → +1. Imports and logistics lines do not raise level.
- **Logistics specialty** starts with **2 free lines** (base + `kind: "specialty"` specialty logistics). Other specialties start with 1 base line.
- RP avoids double-counting: Logistics specialty does **not** also get the generic specialty +1; the specialty line alone contributes 1 via `logisticsRpContribution`.

## L2 — Founding tax, strain stacking, ideology/culture (0.6.0)

- **Founding tax:** uncapped (US/China) pay `colonyCount`; capped blocs pay `2 + colonyCount`. Deducted on successful found (tech floored at 0). UI shows tax hint on Found.
- **Strain stacking:** one cover of a dep serves all *different* developed types (max). Same-type extras stack: D developed of type A need D of each of A's deps. Strain = missing instances. No Stability-special strain/ideology rules. Requires remain fully random.
- **Ideology:** permanent list + develop count + imported tags. Develop: first appends (coexist), second+ overwrites original slot; import+develop blends. Import on route start is permanent (cancel does not remove).
- **Culture:** Population import permanently appends source culture. Culture develop: 50% append foreign if alone, else hybrid blend.

## 0.6.1 — Oxygen, social assist, lend

- **Oxygen:** new node after Water; deps = Infrastructure only. Population still Food+Water.
- **socialAffinity (0–3):** +1 same alliance/liege, +1 shared culture, +1 shared ideology. **0.8.3 consent:** colony↔colony needs `colonyTradeOk` (same bloc / Neutral-patron / same West|East / else aff≥2). Neutrals still trade with everyone. Earth Neutral unrestricted.
- **Lend:** no free own line → borrow highest-affinity ally free line (`lentTo`); borrower gets `via [Ally] Logistics` borrowed capacity; return on cancel / end-turn idle cleanup. Lent lines skip RP.
- **autoAct:** Requires → missing Requires deps → strained deps → switch → pass; uses lend when needed.

See NOTES-0.6.1.md.

## L3 — Identity & soft power (0.7.0)

- **Fervor** (subjects only): barebones ±1 ledger recomputed each tick (0.8.3). Threshold **5**.
- **Revolution:** fervor sum ≥ threshold → `patron=Independent`, `liegeId=self`; sever same-former-patron routes/claims/lends; banner.
- **Independent founding:** spend one free non-base logistics line; child shares culture/ideology and `liegeId` network (bloc affinity).
- **Trojan Subversion (0.8.3):** reverse-logistics send (not trade payload); aff≤1; permanent subversion mark; rare in auto.
- **socialAffinity bloc:** same Earth patron **or** Independent same `liegeId`.

See NOTES-0.7.0.md and PLAN-L3.md.

## 0.7.1 — Trade gates, two-way logistics, reach, social blocs

- **East↔West Earth:** blocked unless **vital** (requires / missing basal / strained dep) **and** no friendly alternative **and** fair (≤1 opposite Earth route at a time). Neutral Earth / Neutral patrons unrestricted. Independents use culture/ideology affinity to Earth blocs or vital+fair.
- **Two-way lines:** each open line carries 1 import + 1 export; colony↔colony needs both slots; lent-away locks both for owner.
- **Reach:** earth / moon / mars theaters — Mars needs Earth-sourced Logistics for Earth imports; Earth lines cannot do Moon↔Mars.
- **Alliance shifts:** subject ideology/culture pressure softens West/East → Neutral (hysteresis); `socialAffinity` bloc point uses current alliance.
- **UI:** Solar independents box below Earth (grouped by `liegeId`); logistics show In/Out + reach.

See NOTES-0.7.1.md.



## 0.7.2 — Corp cultures, culture-forward names, editable labels

- **SpaceX:** culture **Corporate American**, ideology **Corporate Pioneerism**.
- **Corporate China:** culture **Corporate Chinese**, ideology **Platform Socialism**.
- Nation-state blocs keep classic cultures/ideologies.
- **Editable:** rename colony display name, culture chips, ideology (+ imported) chips in the detail panel (`renameColony` / `renameCulture` / `renameIdeology`).

See NOTES-0.7.2.md.

## 0.7.3 — Evocative modular colony names

- Replaces dry `{Culture} {SpecialtyFlavor} {Body}` with seeded Solar Realist names from culture banks (`src/naming.ts`).
- Templates: Fort/Baza/Port + root; root + body + specialty + suffix; corporate Omni-/Helix- brands; sparse ideology hints.
- Soft playtest feel (Armstrong / Nüwa / Korolyova) via **pools**, not hardcoded outputs — fully random/replayable.
- Keeps Corporate American/Chinese tags and all rename APIs.

See NOTES-0.7.3.md.

## 0.8.0 — Nation spine

Earth blocs and Independent lieges are **nations**; colonies are **cities** (shared nationColor). Goal: raise **Nation RP** (sum of member colony RP). Soft leading-nation hint in UI.

- **Founding throttle (superseded 0.8.2):** was cooldown 3 / Moon soft-cap 4; sibling feed export or underfed.
- **Lend:** reach-aware; max 1 attempt/turn; autoAct Needs-before-pass; prefer intra-nation.
- **Vital routes:** tagged; rare blackmail cut; UI badge.
- **Bloc drift:** pressure >= 1 can soften/flip alliances.
- **Solar blocs:** affinity >= 2 + shared route → Independent liege network.
- **Unfair extraction:** +fervor when parent drains underfed child / cancels vital intra-nation.

See NOTES-0.8.0.md. Sim seed 42 × 40 → **13 colonies**.

## 0.8.1 — Needs, feed, Independent

- Need-score act order; Mars Earth-only Logistics unlock.
- Founding: 3rd+ city needs sibling feed surplus; basal feed at birth.
- Intra-nation sibling feed before pass.
- Independent founding bias (surplus + optional free non-vital line; soft cap).

See NOTES-0.8.1.md. Sim seed 42 × 40 → **11 colonies**, pass:develop ~1.5.

## 0.8.2 — Earth cycle, Mars lunar gate, 1 found/turn

- **Founding:** cooldown off (at most **1 colony per turn**); consecutive turns OK.
- **Earth prefer:** auto-policy ranks legal Earth sources ahead of colony sources for Needs.
- **Earth cycle:** free logistics + no urgent Need → probe-import non-vital Earth excess (`earthCycle`); cancel next turn to reroll/unlock.
- **Mars gate:** require strong lunar basis (≥2 Moon cities + Moon RP≥4 or export capacity) OR lunar ally feed; else force Moon. Moon soft-cap raised to **8**.

See NOTES-0.8.2.md.

## 0.8.3 — Affinity ≥ 2, fervor ledger, Trojan send, bilateral

- **Colony trade:** rivals need socialAffinity ≥ 2; Neutral Earth + Neutral-patron colonies stay open.
- **Fervor:** recomputed ±1 ledger; independence at threshold **5**.
- **Trojan:** sendable reverse logistics; permanent mark; no trade node.
- **Logistics:** one consented bilateral `X ⇄ Y` per colony↔colony link.

See NOTES-0.8.3.md. Sim seed 42 × 40 → **29 colonies**, **4 revolutions**.

## 0.9.2 — Pre-sim fervor setup lobby

On load / New game, pick a named fervor variant (`realistic_survival` default), review summary + knobs, optionally override independence threshold, then **Begin simulation**. See NOTES-0.9.2.md. Solar-bloc timing + Diplomacy lobby tab: NOTES-0.9.3.md.

## 0.9.0 — L4 Survival & military

- **Independence threshold** editable (`G.independenceThreshold`, default **10** in 0.9.2) via UI + session; full `FervorParams` via `applyFervorParams` / `npm run sim:fervor`.
- **Survival clocks** food/water/(oxygen if not livable); Health=Stability slows to every other turn; trip at 3 → refugees.
- **Refugees** seek same-body Food/Water hosts, then willing aff≥2 / same-nation, else livable Independent Resources found, else stranded.
- **Invade:** Military token, cross-nation same-body; destroy node → RP compare (tie=defender) → annex or burn Military; thin West↔East threat 0–3.
- **TF livable** at bodyTF ≥ 10.

See NOTES-0.9.0.md and PLAN-L4.md.
