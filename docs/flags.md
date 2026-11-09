# Flag grammar (0.15.0, revised 0.15.1)

Code: `src/flagDesign.ts` (pure, deterministic, no DOM) → `flagDesignToSvg(design, w, h)`.
Game wiring: `src/flagLineage.ts` (`flagForColony(G, c)`, `flagForEarth(bloc)`), used by colony cards, supplier cards, route labels on the globes and the solar map strip. Gallery: `?flags` or Rules tab → **Flag gallery**. Tests: `tests/flagDesign.test.ts`.

Flags are **original designs inspired by real traditions**, not copies of real national flags (Earth bloc base flags deliberately echo their tradition).

## Rules (NAVA "Good Flag, Bad Flag")

1. **Keep it simple** — one field layout + at most 2 charges (ideology/lineage emblem in the canton, specialty in the fly). Recognizable at 24×16 (map strip is 15×10).
2. **Meaningful symbolism** — layout = nationality, charge = function (specialty), colours/emblem = ideology, tincture shade = body.
3. **2–3 basic colours** from the standard tincture set; a **4th only with a named tradition** (`justification`; today only the African Union base flag's Pan-African black stars).
4. **No lettering or seals.**
5. **Distinctive or related** — daughters reuse their bloc's palette + layout family (related) but are differenced by a hash of seed + colony id (siblings differ). Daughters of different blocs never collide (tested).

6. **Stars and stripes / ensign:** the canton carries the emblem; at most **one** extra charge outside it.
7. **Multinational blocs never copy one country's flag:** the alliance carries a union mark (EAPA sun disc inside a blue bordure — not Japan; AU, Latin Federation and South Asian Commonwealth use a ring of stars — not Ghana/Ethiopia, Colombia/Ecuador or India's chakra; the Commonwealth ensign adds a star in the fly — not a bare Blue Ensign).

**Rule of tincture / contrast:** charges are metal-on-colour or colour-on-metal **and** WCAG contrast ≥ 3; adjacent fields must differ and have contrast ≥ 1.4. **Forbidden pairs** (vanish even though the class rule passes): or ↔ saffron — never as a charge on a field nor as adjacent fields. Every palette is forced to hold at least one metal and one colour. If no layout/permutation passes, the fallback is a plain colour field with a metal charge.

## Tinctures

| Name | Hex | Class |
|---|---|---|
| argent | #FFFFFF | metal |
| or | #FCD116 | metal |
| lunar (Moon variant of argent) | #C9CED6 | metal |
| gules | #C8102E | colour |
| rust (Mars variant of gules) | #A3401C | colour |
| azure | #0033A0 | colour |
| celeste | #4B92DB | colour |
| vert | #007A3D | colour |
| sable | #000000 | colour |
| purpure | #5B2C83 | colour |
| saffron | #FF9933 | colour |

The designer's muted UI palette is **not** used for flags: real tradition colours win. Every flag gets a 1px **#5A6B7D** keyline (0.15.1, lighter so black/navy flags separate from the dark UI).

## Small mode (≤30px wide)

`flagDesignToSvg(d, w, h)` switches automatically when `w ≤ 30` (route labels 30×20, map strip 15–18px, colony-card icons 21×14; supplier cards at 48×32 stay full): 5 stripes instead of 13, union as a plain cross + saltire (no fimbriation), the star ring becomes 6 dots, and the specialty charge is dropped (layout + ideology/lineage emblem stay). Force with `{ small: true|false }`.

## Traditions (nationality)

| Bloc | Tradition | Palette | Base flag | Daughter layouts |
|---|---|---|---|---|
| United States | Stars and stripes (US) | gules / argent / azure | starsStripes + star | starsStripes, ensign, bicolorH |
| China | Communist red field with gold star (PRC) | gules / or | plain + star | plain, hoistTriangle, bicolorV |
| SpaceX | Corporate minimal bars (US corporate) | sable / argent / azure | corporateBars | corporateBars, bicolorV |
| Corporate China | Corporate minimal bars on socialist red/gold | sable / gules / or | corporateBars + star | corporateBars, bicolorV |
| European Union | Blue field with ring of gold stars; Nordic-cross and tricolour daughters (European) | azure / or / argent | plain + starRing | nordic, tricolorV, plain |
| Russian Federation | Pan-Slavic white-blue-red tricolour | argent / azure / gules | tricolorH | tricolorH, tricolorV, ensign |
| Latin Federation | Pan-Iberian / Gran Colombia yellow-blue-red; ring of stars marks the federation (not Colombia/Ecuador) | or / azure / gules | tricolorH + starRing | tricolorH, tricolorV, hoistTriangle |
| African Union | Pan-African green-gold-red; ring of black stars marks the union (not Ghana/Ethiopia) | vert / or / gules (+sable) | tricolorH + starRing | tricolorH, tricolorV, hoistTriangle |
| New Caliphate | Islamic green with white crescent and star; Pan-Arab black-white-green | vert / argent / sable | plain + crescentStar | bicolorV, tricolorH, plain |
| South Asian Commonwealth | Saffron-white-green tricolour with a ring of stars (South Asian union; not India's chakra) | saffron / argent / vert | tricolorH + starRing | tricolorH, tricolorV, bicolorV |
| East Asian Pacific Alliance | East Asian sun disc inside a blue Pacific bordure (alliance mark; not Japan) | argent / gules / azure | discBordure | disc, bicolorH, bend |
| Dominion of Indochina | Red-blue-red with white disc (Indochinese) | gules / azure / argent | tricolorH + orbitRing | tricolorH, disc, bicolorH |
| British Commonwealth | Ensign with union canton (Commonwealth / Blue Ensign lineage) | azure / argent / gules | ensign + union + star (fly) | ensign, ensign, nordic |
| United Nations | UN light blue with white emblem (internationalist) | celeste / argent | plain + orbitRing | plain, bicolorH, ensign |

Layouts: plain, tricolorV, tricolorH, bicolorH, bicolorV, nordic (cross), ensign (canton), starsStripes (13 stripes), hoistTriangle, chevron, bend, disc, discBordure, corporateBars. 300×200 (3:2) viewBox.

## Ideology families

Keyword match on the colony's first ideology (hybrids like `A-B` take the first family that matches):

| Family | Matches | Colours | Charge |
|---|---|---|---|
| islamic | islam, caliph, faith | vert / argent (adds vert) | crescent and star |
| corporate | corporate, platform | sable / argent (sable field, corporate bars first) | — |
| socialist | socialism/-ist, bolivarian | gules / or (adds gules) | star |
| nationalist | putin, conservat, sovereign | gules / argent | — |
| technocratic | technocra | azure / argent | — |
| internationalist | institution | celeste / argent | — |
| developmental | develop, pragmatic | vert / or | — |
| radical | situation | sable / or | — |
| pioneer | pioneer | purpure / or | — |
| liberal (default) | everything else | azure / argent | — |

With no ideology charge, a daughter repeats its bloc emblem (US star, EU/AU/Latin/South Asian star ring, UN and Indochina orbit ring); British daughters usually fly the union in the canton (Blue Ensign lineage).

## Function (specialty charge)

Each of the 19 nodes has a simple silhouette charge (e.g. Water drop, Food wheat, Production gear, Logistics orbit, Military shield, Science flask, Thrust rocket, Energy bolt, Terraforming ringed planet). Placed per tradition: fly of an ensign, centre of a tricolour/disc, canton of a hoist triangle/chevron/bend.

## Body

Used sparingly (~1 in 3 colonies, by hash): on Mars gules becomes rust; on the Moon argent becomes lunar grey. It is a shade swap, never an extra colour.

## Lineage, flip, independence

- `Colony.originPatron` (presentation only) records the founding bloc; Independents inherit it from their liege.
- **Colonial**: origin palette + daughter layouts, ideology tweaks, specialty charge.
- **Bloc flip** (patron ≠ origin): new patron's palette; tries the origin's base layout first → heritage = layout, else a shared colour.
- **Independence**: a revolutionary national flag (hoist triangle, bend, chevron, bicolour, vertical tricolour — never the origin's base layout) built from the liege: keeps **one heritage colour** (the founding bloc's primary) + the liege's ideology colours; ideology emblem in the canton (star by default). All colonies of that nation share layout + palette; the liege flies the plain national flag, members add their specialty in the fly.
