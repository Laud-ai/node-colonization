# Flag grammar (0.15.0)

Code: `src/flagDesign.ts` (pure, deterministic, no DOM) → `flagDesignToSvg(design, w, h)`.
Game wiring: `src/flagLineage.ts` (`flagForColony(G, c)`, `flagForEarth(bloc)`), used by colony cards, supplier cards, route labels on the globes and the solar map strip. Gallery: `?flags` or Rules tab → **Flag gallery**. Tests: `tests/flagDesign.test.ts`.

Flags are **original designs inspired by real traditions**, not copies of real national flags (Earth bloc base flags deliberately echo their tradition).

## Rules (NAVA "Good Flag, Bad Flag")

1. **Keep it simple** — one field layout + at most 2 charges (ideology/lineage emblem in the canton, specialty in the fly). Recognizable at 24×16 (map strip is 15×10).
2. **Meaningful symbolism** — layout = nationality, charge = function (specialty), colours/emblem = ideology, tincture shade = body.
3. **2–3 basic colours** from the standard tincture set; a **4th only with a named tradition** (`justification`; today only the African Union base flag's Pan-African black star).
4. **No lettering or seals.**
5. **Distinctive or related** — daughters reuse their bloc's palette + layout family (related) but are differenced by a hash of seed + colony id (siblings differ). Daughters of different blocs never collide (tested).

**Rule of tincture / contrast:** charges are metal-on-colour or colour-on-metal **and** WCAG contrast ≥ 3; adjacent fields must differ and have contrast ≥ 1.4. Every palette is forced to hold at least one metal and one colour. If no layout/permutation passes, the fallback is a plain colour field with a metal charge.

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

The designer's muted UI palette is **not** used for flags: real tradition colours win (flags get a 1px #2A3A4D keyline to sit on the dark UI).

## Traditions (nationality)

| Bloc | Tradition | Palette | Base flag | Daughter layouts |
|---|---|---|---|---|
| United States | Stars and stripes (US) | gules / argent / azure | starsStripes + star | starsStripes, ensign, bicolorH |
| China | Communist red field with gold star (PRC) | gules / or | plain + star | plain, hoistTriangle, bicolorV |
| SpaceX | Corporate minimal bars (US corporate) | sable / argent / azure | corporateBars | corporateBars, bicolorV |
| Corporate China | Corporate minimal bars on socialist red/gold | sable / gules / or | corporateBars + star | corporateBars, bicolorV |
| European Union | Blue field with ring of gold stars; Nordic-cross and tricolour daughters (European) | azure / or / argent | plain + starRing | nordic, tricolorV, plain |
| Russian Federation | Pan-Slavic white-blue-red tricolour | argent / azure / gules | tricolorH | tricolorH, tricolorV, ensign |
| Latin Federation | Pan-Iberian / Gran Colombia yellow-blue-red | or / azure / gules | tricolorH | tricolorH, tricolorV, hoistTriangle |
| African Union | Pan-African green-gold-red with black star (Ghana tradition) | vert / or / gules (+sable) | tricolorH + star | tricolorH, tricolorV, hoistTriangle |
| New Caliphate | Islamic green with white crescent and star; Pan-Arab black-white-green | vert / argent / sable | plain + crescentStar | bicolorV, tricolorH, plain |
| South Asian Commonwealth | Saffron-white-green tricolour with wheel (South Asian) | saffron / argent / vert | tricolorH + orbitRing | tricolorH, tricolorV, bicolorV |
| East Asian Pacific Alliance | Centre-disc (East Asian sun disc) | argent / gules / azure | disc | disc, bicolorH, bend |
| Dominion of Indochina | Red-blue-red with white disc (Indochinese) | gules / azure / argent | tricolorH + orbitRing | tricolorH, disc, bicolorH |
| British Commonwealth | Ensign with union canton (Commonwealth / Blue Ensign lineage) | azure / argent / gules | ensign + union | ensign, ensign, nordic |
| United Nations | UN light blue with white emblem (internationalist) | celeste / argent | plain + orbitRing | plain, bicolorH, ensign |

Layouts: plain, tricolorV, tricolorH, bicolorH, bicolorV, nordic (cross), ensign (canton), starsStripes, hoistTriangle, chevron, bend, disc, corporateBars. 300×200 (3:2) viewBox.

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

With no ideology charge, a daughter repeats its bloc emblem (US star, EU star ring, UN orbit ring, Indochina/South Asia wheel ring); British daughters usually fly the union in the canton (Blue Ensign lineage).

## Function (specialty charge)

Each of the 19 nodes has a simple silhouette charge (e.g. Water drop, Food wheat, Production gear, Logistics orbit, Military shield, Science flask, Thrust rocket, Energy bolt, Terraforming ringed planet). Placed per tradition: fly of an ensign, centre of a tricolour/disc, canton of a hoist triangle/chevron/bend.

## Body

Used sparingly (~1 in 3 colonies, by hash): on Mars gules becomes rust; on the Moon argent becomes lunar grey. It is a shade swap, never an extra colour.

## Lineage, flip, independence

- `Colony.originPatron` (presentation only) records the founding bloc; Independents inherit it from their liege.
- **Colonial**: origin palette + daughter layouts, ideology tweaks, specialty charge.
- **Bloc flip** (patron ≠ origin): new patron's palette; tries the origin's base layout first → heritage = layout, else a shared colour.
- **Independence**: a revolutionary national flag (hoist triangle, bend, chevron, bicolour, vertical tricolour — never the origin's base layout) built from the liege: keeps **one heritage colour** (the founding bloc's primary) + the liege's ideology colours; ideology emblem in the canton (star by default). All colonies of that nation share layout + palette; the liege flies the plain national flag, members add their specialty in the fly.
