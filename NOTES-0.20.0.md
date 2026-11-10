# 0.20.0 — The asteroid belt

Tiago approved the belt plan with one change: **no new resources** (no Metals or Volatiles). Everything is behind the new Rules-tab group **"Asteroid Belt"**. Each rule defaults on; turning them off gives exactly 0.19.0.

## Rules
| id | default | what it does |
|---|---|---|
| `beltColonies` | on | Master switch. **Thrust = line reach.** A line reaches the belt only if its owner (or, for a lent line, its lender) has belt Thrust ≥ `beltThrustReach`. The belt trades **only with Mars**: no Earth, no Moon, no Belt↔Belt. Mars still never trades with Earth. Founding a belt colony needs a Mars colony of your own nation or an ally (Neutral and Independent: your own) with belt reach. This mirrors the Moon→Mars rule. After the Moon soft cap, a nation that can found in the belt does so while the belt has fewer than max(1, ⌊Mars/2⌋) colonies; otherwise it founds on Mars. A belt colony's own base line is its founding ship and always reaches Mars. |
| `beltThrustReach` | 1 | Thrust needed for belt reach (1–6). Thrust = Thrust extras (+1 Orbital Shipyard). |
| `beltRichSpecialty` | on | **Belt value without new resources.** A belt colony's specialty is drawn from Thrust / Production / Resources / Logistics, and the rich asteroid makes it count **×2** in extras. That doubles what the colony can export to Mars. |
| `beltDepot` | on | **Refuel depots.** A friendly belt colony with Thrust ≥ 1 gives every other friendly colony +1 belt Thrust, which extends allied reach. |
| `beltMilestone` | on | The first belt colony of an Earth bloc gives that bloc +`beltMilestoneTech` tech (default 2), logged as 🚀 BELT MILESTONE plus an announcement. |
| `beltMilestoneTech` | 2 | Size of the milestone boost. |

**Hostile:** the belt has no atmosphere and is never livable. The O₂ clock is always 1 turn there (thin air never applies), and Terraforming has no effect. Oxygen crises and oxygen wars apply as anywhere else.

**Relays:** a Mars colony holding a relay of an Earth good may relay it once more to a belt colony (Moon → Mars → Belt). The belt leg is flown with the Mars colony's own Thrust. If the root import ends, the whole chain drops.

## UI
- **Belt panel** sits beside the Moon and Mars panels. The views are now Moon + Mars + Belt (3 columns), Moon, Mars and Belt.
  - It shows a rotatable, zoomable ring of 12 named asteroids: Ceres, Vesta, Pallas, Hygiea, Psyche, Juno, Interamnia, Davida, Europa, Sylvia, Eunomia and Eros.
  - **Ceres and Vesta** are textured with NASA Dawn Framing Camera global mosaics, NASA/JPL-Caltech/UCLA/MPS/DLR/IDA, via USGS Astrogeology Astropedia: *Ceres Dawn FC Global Mosaic 400m* and *Vesta Dawn FC HAMO Global Mosaic 60m*, 1024×512. They are public domain (NASA), and USGS lists no use constraints beyond citing the authors.
  - The other asteroids are procedural shaded rocks (displaced icospheres with flat shading) set in a dust ring.
  - Pins, flags, badges and alerts are the same as on the Moon and Mars. Pins are ray-cast onto the rock surface. The limb/occlusion test runs per rock, and rocks block picking.
  - Colonies are placed by seed: a weighted rock choice (Ceres, Vesta and Psyche favoured) plus a spaced site on that rock.
  - Mars↔Belt routes are outer lines with the partner's flag, on both panels.
  - Belt textures load only when the belt panel is first visible. Clicking a belt colony points the camera at its rock. Switching views refits the ring.
- **Map legend window** (Legend button in the globe bar, or Windows menu): pin and badge samples drawn with the real pin renderer, needs-tree colours, and route styles. It replaces the old inline legend.
- **Late-game route crowding:** outer routes from one colony to the same body in the same direction are grouped into one line with one partner flag and a ×N badge. The tooltip lists every partner. A label on top of an earlier label is now hidden instead of dimmed.
- The solar map strip has a fourth body, the belt (dotted ring, no TF bar).
- Announcement banners no longer block clicks on the globe bar. In Firefox the bar wraps to two rows and the banner covered the Routes button.

## Before / after (seeds 42, 7, 99, 123, 5 × 120 turns, `MODES=v0190,v0200,reach2,noRich npm run sim:passes`)
| | 0.19.0 (all belt rules off) | 0.20.0 |
|---|---|---|
| Belt colonies / seed | 0 | 0.4 (seed 7: T61, seed 5: T53; never on 42, 99, 123) |
| Thrust total at end / seed | 47.2 | 45.4 |
| Pass rate overall / L1 | 21.6% / 30.3% | 20.9% / 28.1% |
| Mars pass rate | 55.2% | 49.1% |
| Belt pass rate | — | 64.8% |
| Develops / seed (Gini) | 549 (0.38) | 522 (0.33) |
| Mars develops / seed | 54.0 | 58.8 |
| Belt develops / seed | — | 1.4 |
| Revolutions | 51 | 46 |
| Belt O₂ crises | — | 0 |
| Belt milestones | — | 2 |
| Mars colonies / colonies per seed | 5.0 / 20.0 | 4.2 / 19.0 |
| O₂ deaths | 11 | 11 |

Ablations:
- `reach2` (threshold 2): 0.2 belt colonies per seed (seed 5 only), pass rate 22.5%, Mars 55.7%.
- `noRich`: belt pass rate 67.2%, 1.0 belt develops per seed.
- `noDepot` is the same as 0.20.0, because no depot formed in 120 turns.

**Finding:** the belt is rare because late founding is rare. After T40 the five seeds have only about 14 foundings in total, mostly Neutral blocs, and the belt gate was open for only a few of them. A later version could let a Mars colony found a belt outpost.
